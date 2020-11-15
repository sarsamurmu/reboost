import type Babel from '@babel/core';

import { PluginContext, ReboostPlugin } from 'reboost';

declare namespace BabelPlugin {
  export type Options = Babel.TransformOptions;
}

function BabelPlugin(options: BabelPlugin.Options = {}): ReboostPlugin {
  let babel: typeof Babel;
  const compatibleTypes = ['js', 'jsx', 'ts', 'tsx', 'es', 'es6', 'mjs', 'cjs'];

  const loadBabel = (resolve: PluginContext['resolve'], chalk: PluginContext['chalk']) => {
    if (!babel) {
      try {
        babel = require(resolve(__filename, '@babel/core', { mainFields: ['main'] }));

        options = Object.assign<any, any, Babel.TransformOptions>({}, options, {
          ast: false,
          sourceMaps: true,
          sourceType: 'module',
        });

        // Warm up babel
        babel.transformAsync('', options);
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "@babel/core" package in order to use BabelPlugin.\n' +
            'Please run "npm i @babel/core" to install Babel.'
          ));
        } else {
          console.error(e);
        }
      }
    }
    return true;
  }

  return {
    name: 'babel-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(options) + `@v${babel && babel.version}`,
    setup({ resolve, chalk }) {
      loadBabel(resolve, chalk);
    },
    async transformContent(data, filePath) {
      if (!loadBabel(this.resolve, this.chalk)) return;

      if (compatibleTypes.includes(data.type)) {
        try {
          const { code, map } = await babel.transformAsync(data.code, options);

          map.sources = [filePath];

          return {
            code,
            map
          }
        } catch (e) {
          let message = `BabelPlugin: Error while transforming "${this.rootRelative(filePath)}"\n`;
          message += e.message.replace(/^unknown: /, '');

          return new Error(message);
        }
      }

      return null;
    }
  }
}

export = BabelPlugin;
