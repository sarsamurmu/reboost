import type Babel from '@babel/core';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace BabelPlugin {
  export type Options = Babel.TransformOptions;
}

function BabelPlugin(options: BabelPlugin.Options = {}): ReboostPlugin {
  let babel: typeof Babel;
  const compatibleTypes = ['js', 'jsx', 'ts', 'tsx', 'es', 'es6', 'mjs', 'cjs'];

  return {
    name: 'babel-plugin',
    setup({ resolve, chalk }) {
      const babelPath = resolve(__filename, '@babel/core', {
        mainFields: ['main']
      });

      if (babelPath) {
        babel = require(babelPath);

        options = Object.assign<any, any, Babel.TransformOptions>({}, options, {
          ast: false,
          sourceMaps: true,
          sourceType: 'module',
        });

        // Warm up babel
        babel.transformAsync('', options);
      } else {
        console.log(chalk.red('You need to install "@babel/core" package in order to use BabelPlugin.'));
        console.log(chalk.red('Please run "npm i @babel/core" to install Babel.'));
      }
    },
    async transformContent(data, filePath) {
      if (!babel) return;

      if (compatibleTypes.includes(data.type)) {
        try {
          const { code, map } = await babel.transformAsync(data.code, options);

          map.sources = [filePath];

          return {
            code,
            map
          }
        } catch (e) {
          let message = `BabelPlugin: Error while transforming "${path.relative(this.config.rootDir, filePath)}"\n`;
          message += e.message.replace(/^unknown: /, '');

          return new Error(message);
        }
      }

      return null;
    }
  }
}

export = BabelPlugin;
