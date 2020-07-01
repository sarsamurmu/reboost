import { parse, compileTemplate, compileStyleAsync } from '@vue/compiler-sfc';
import hashSum from 'hash-sum';

import path from 'path';

import { ReboostPlugin, RawSourceMap } from 'reboost';

interface Options {
  
}

export = (options: Options = {}): ReboostPlugin => {
  return {
    name: 'vue-plugin',
    async transformContent(data, filePath) {
      if (data.type === 'vue') {
        const { descriptor } = parse(data.code, {
          sourceMap: true,
          filename: filePath
        });
        const id = hashSum(path.relative(this.config.rootDir, filePath));

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

            const result = await compileStyleAsync({
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

        const compiled = compileTemplate({
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
          map: descriptor.script.map as any,
          type: 'js',
        }
      }

      return null;
    }
  }
}
