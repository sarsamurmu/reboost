import * as Compiler from '@vue/compiler-sfc';
import hashSum from 'hash-sum';

import { ReboostPlugin, RawSourceMap } from 'reboost';

declare namespace VuePlugin {
  export interface Options {
    compiler?: any;
  }
}

function VuePlugin(options: VuePlugin.Options = {}): ReboostPlugin {
  let compiler = Compiler;

  if (options.compiler) compiler = options.compiler;

  return {
    name: 'vue-plugin',
    async transformContent(data, filePath) {
      if (data.type === 'vue') {
        const { descriptor } = compiler.parse(data.code, {
          sourceMap: true,
          filename: filePath
        });
        const id = hashSum(this.rootRelative(filePath));

        let preCode = 'const __modExp = {}';
        const postCode = `
          __modExp.render = render;
          export default __modExp;
        `;

        if (descriptor.script) {
          preCode = descriptor.script.content.replace('export default', 'const __modExp =');
        }

        let cssStr = '';
        let cssMap: RawSourceMap;
        let hasScopedCSS = false;
        const promises: Promise<any>[] = [];

        descriptor.styles.forEach((styleBlock) => {
          promises.push((async () => {
            if (!hasScopedCSS) hasScopedCSS = styleBlock.scoped;

            const result = await compiler.compileStyleAsync({
              filename: filePath,
              source: styleBlock.content,
              id: `data-v-${id}`,
              scoped: styleBlock.scoped,
              modules: !!styleBlock.module,
              preprocessLang: styleBlock.lang as any,
            });

            cssStr += result.code;
            cssMap = await this.mergeSourceMaps(cssMap, styleBlock.map as any);
          })());
        });

        await Promise.all(promises);

        const compiled = compiler.compileTemplate({
          filename: filePath,
          compilerOptions: {
            scopeId: hasScopedCSS ? `data-v-${id}` : null
          },
          source: descriptor.template.content,
          preprocessLang: descriptor.template.lang
        });

        cssMap = this.getCompatibleSourceMap(cssMap);
        cssStr += '\n\n' + this.getSourceMapComment(cssMap);

        const CSSCode = `
          const styleTag = document.createElement('style');
          styleTag.innerHTML = ${JSON.stringify(cssStr)};
          document.head.appendChild(styleTag);
        `;

        return {
          code: `${preCode};${compiled.code};${CSSCode};${postCode};`,
          map: descriptor.script && descriptor.script.map as any,
          type: 'js',
        }
      }

      return null;
    }
  }
}

export = VuePlugin;
