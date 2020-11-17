import * as Compiler from '@vue/compiler-sfc';
import hashSum from 'hash-sum';

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

  // TODO: Fix issue with multiple source map when multiple style blocks are used

  return {
    name: 'vue-plugin',
    getCacheKey: () => JSON.parse(
      fs.readFileSync(require.resolve('@vue/compiler-sfc/package.json')).toString()
    ).version,
    async transformContent(data, filePath) {
      if (data.type === 'vue') {
        const { descriptor } = compiler.parse(data.code, {
          sourceMap: true,
          filename: filePath
        });
        const id = hashSum(this.rootRelative(filePath));

        let preCode = 'const __modExp = {}';

        if (descriptor.script) {
          preCode = descriptor.script.content.replace('export default', 'const __modExp =');
        }

        let cssStr = '';
        let cssMap: RawSourceMap;
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
              result.map.sources.forEach((source, idx) => {
                if (source === path.basename(filePath)) result.map.sources[idx] = filePath;
              });
            }

            cssStr += result.code;
            cssMap = await this.mergeSourceMaps(styleBlock.map as any, result.map as any)
          })
        );

        const template = compiler.compileTemplate({
          filename: filePath,
          compilerOptions: {
            scopeId: hasScopedCSS ? `data-v-${id}` : null
          },
          source: descriptor.template.content,
          preprocessLang: descriptor.template.lang
        });

        cssStr += '\n\n' + this.getSourceMapComment(
          this.getCompatibleSourceMap(cssMap)
        );

        const postCode = `
          __modExp.render = render;

          import { hot as ReboostHot } from 'reboost/hot';

          let __hmrData = {
            hash: {
              script: ${blockHash(descriptor.script)},
              scriptSetup: ${blockHash(descriptor.scriptSetup)},
              template: ${blockHash(descriptor.template)},
              style: ${styleHash(descriptor.styles)}
            },
            style: ${JSON.stringify(cssStr)},
          }
          let __styleEl;
          export const __HMR_DATA__ = __hmrData;

          // NOTE: This enables HMR in Vue internally
          __modExp.__hmrId = ReboostHot.id;

          if (!ReboostHot.data) {
            __styleEl = document.createElement('style');
            __styleEl.textContent = __hmrData.style;
            document.head.appendChild(__styleEl);
          }

          if (!ReboostHot.data && __VUE_HMR_RUNTIME__) {
            __VUE_HMR_RUNTIME__.createRecord(ReboostHot.id, __modExp);

            ReboostHot.self.accept((updatedModule) => {
              const component = updatedModule.default;
              const newHMRData = updatedModule.__HMR_DATA__;
              const curHash = __hmrData.hash;
              const newHash = newHMRData.hash;

              if (
                curHash.script !== newHash.script ||
                curHash.scriptSetup !== newHash.scriptSetup ||
                curHash.style !== newHash.style
              ) {
                __VUE_HMR_RUNTIME__.reload(ReboostHot.id, component);
              } else if (curHash.template !== newHash.template) {
                __VUE_HMR_RUNTIME__.rerender(ReboostHot.id, component.render);
              }

              if (__hmrData.style !== newHMRData.style) {
                __styleEl.textContent = newHMRData.style;
              }

              __hmrData = newHMRData;
            });
          }

          export default __modExp;
        `;

        return {
          code: `${preCode};${template.code};${postCode};`,
          map: descriptor.script && descriptor.script.map as any,
          type: 'js',
        }
      }

      return null;
    }
  }
}

export = VuePlugin;
