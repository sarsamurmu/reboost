import { parse, compileTemplate, compileStyleAsync } from '@vue/compiler-sfc';
import hashSum from 'hash-sum';

import path from 'path';

import { ReboostPlugin } from 'reboost';

interface Options {
  
}

export = (options: Options = {}): ReboostPlugin => {
  let compiler: any;

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

        let css = '';
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

            css += result.code;
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

        return {
          code: preCode + '\n' + compiled.code + '\n' + postCode,
          map: null,
          type: 'js',
        }
      }

      return null;
    }
  }
}
