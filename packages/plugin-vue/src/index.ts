import * as Compiler from '@vue/compiler-sfc';
import hashSum from 'hash-sum';
import { codeFrameColumns } from '@babel/code-frame';
import combineSourceMap from 'combine-source-map';
import convertSourceMap from 'convert-source-map';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { ReboostPlugin, RawSourceMap } from 'reboost';

declare namespace VuePlugin {
  export interface Options {
    compiler?: any;
  }
}

const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');
const blockHash = (block: Compiler.SFCBlock) => {
  return block && JSON.stringify(
    md5(
      JSON.stringify([
        ['src', block.src],
        ['content', block.content],
        ['attrs', Object.keys(block.attrs).sort().map((key) => [key, block.attrs[key]])]
      ])
    )
  );
}
const styleHash = (blocks: Compiler.SFCStyleBlock[]) => {
  return blocks && blocks.length && JSON.stringify(
    md5(
      JSON.stringify(blocks.map((block) => [
        ['isModule', !!block.module],
        ['vars', block.attrs.vars],
        ['isScoped', !!block.scoped],
      ]))
    )
  );
}

function VuePlugin(options: VuePlugin.Options = {}): ReboostPlugin {
  let compiler = Compiler;

  if (options.compiler) compiler = options.compiler;

  return {
    name: 'vue-plugin',
    getCacheKey: () => JSON.parse(
      fs.readFileSync(require.resolve('@vue/compiler-sfc/package.json'), 'utf8')
    ).version,
    async transformContent(data, filePath) {
      if (data.type === 'vue') {
        const { descriptor, errors } = compiler.parse(data.code, {
          sourceMap: true,
          filename: filePath
        });
        const id = hashSum(this.rootRelative(filePath));

        if (errors && errors.length) {
          return new Error(
            errors.map((error: Compiler.CompilerError) => {
              let msg = `VuePlugin: Error when parsing "${this.rootRelative(filePath)}"\n`;
              msg += `${error.message} on line ${error.loc.start.line} at column ${error.loc.start.column}\n\n`;

              msg += codeFrameColumns(data.code, {
                start: error.loc.start,
                end: error.loc.end
              }, {
                message: error.message,
                highlightCode: true,
              });

              return msg;
            }).join('\n\n')
          );
        }

        let preCode = 'const __modExp = {}';
        let scriptMap: RawSourceMap;

        if (descriptor.script || descriptor.scriptSetup) {
          try {
            const script = compiler.compileScript(descriptor, {
              id,
              isProd: false
            });

            preCode = compiler.rewriteDefault(script.content, '__modExp');
            scriptMap = script.map as any;

            if (script.lang === 'ts') {
              // TODO: Use <PluginContext>.runTransformation() when available to transform into JS
            }
          } catch (e) {
            let msg = `VuePlugin: Error when compiling <script setup> in "${this.rootRelative(filePath)}"\n`;
            msg += e.message;
            return new Error(msg);
          }
        }

        const cssData: [css: string, map: RawSourceMap][] = [];
        let hasScopedCSS = false;

        await Promise.all(
          descriptor.styles.map(async (styleBlock) => {
            if (!hasScopedCSS) hasScopedCSS = styleBlock.scoped;

            const result = await compiler.compileStyleAsync({
              filename: filePath,
              source: styleBlock.content,
              id: `data-v-${id}`,
              scoped: styleBlock.scoped,
              modules: !!styleBlock.module,
              preprocessLang: styleBlock.lang as any,
              postcssOptions: {
                from: filePath,
                to: filePath,
                map: {
                  inline: false,
                  annotation: false
                }
              }
            });

            if (result.map) {
              result.map.sources.forEach((source, idx, sources) => {
                if (source === path.basename(filePath)) sources[idx] = filePath;
              });
            }

            cssData.push([result.code, await this.mergeSourceMaps(styleBlock.map as any, result.map as any)]);
          })
        );

        const template = compiler.compileTemplate({
          id,
          filename: filePath,
          compilerOptions: {
            scopeId: hasScopedCSS ? `data-v-${id}` : null
          },
          source: descriptor.template.content,
          preprocessLang: descriptor.template.lang
        });

        let cssStr = '';
        let cssMap: RawSourceMap;
        if (cssData.length) {
          if (cssData.length === 1) {
            [cssStr, cssMap] = cssData[0];
          } else {
            const combiner = combineSourceMap.create();
            let offsetLine = 0;
            cssData.forEach(([css, map]) => {
              cssStr += css;
              combiner.addFile({
                sourceFile: path.basename(filePath),
                source: css + '\n' + convertSourceMap.fromObject(map).toComment({ multiline: true })
              }, { line: offsetLine });
              offsetLine += css.match(/\n/g).length;
            });
            cssMap = convertSourceMap.fromBase64(combiner.base64()).toObject();
          }
        }

        if (cssMap) {
          cssStr += '\n\n' + this.getSourceMapComment(
            this.getCompatibleSourceMap(cssMap)
          );
        }

        const postCode = `
          __modExp.render = render;

          let __hmrData = {
            hash: {
              script: ${blockHash(descriptor.script)},
              scriptSetup: ${blockHash(descriptor.scriptSetup)},
              template: ${blockHash(descriptor.template)},
              style: ${styleHash(descriptor.styles)}
            },
            style: ${JSON.stringify(cssStr)},
          }
          export const __HMR_DATA__ = __hmrData;

          // NOTE: This enables HMR in Vue internally
          __modExp.__hmrId = import.meta.hot.id;

          if (!import.meta.hot.data) {
            const styleEl = document.createElement('style');
            styleEl.textContent = __hmrData.style;
            document.head.appendChild(styleEl);

            if (__VUE_HMR_RUNTIME__) {
              __VUE_HMR_RUNTIME__.createRecord(import.meta.hot.id, __modExp);

              import.meta.hot.accept((updatedModule) => {
                const component = updatedModule.default;
                const newHMRData = updatedModule.__HMR_DATA__;
                const curHash = __hmrData.hash;
                const newHash = newHMRData.hash;

                if (
                  curHash.script !== newHash.script ||
                  curHash.scriptSetup !== newHash.scriptSetup ||
                  curHash.style !== newHash.style
                ) {
                  __VUE_HMR_RUNTIME__.reload(import.meta.hot.id, component);
                } else if (curHash.template !== newHash.template) {
                  __VUE_HMR_RUNTIME__.rerender(import.meta.hot.id, component.render);
                }

                if (__hmrData.style !== newHMRData.style) {
                  styleEl.textContent = newHMRData.style;
                }

                __hmrData = newHMRData;
              });
            }
          }

          export default __modExp;
        `;

        return {
          code: `${preCode};${template.code};${postCode};`,
          map: scriptMap,
          type: 'js',
        }
      }

      return null;
    }
  }
}

export = VuePlugin;
