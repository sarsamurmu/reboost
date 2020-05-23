import esbuild, { Target } from 'esbuild';

import { ReboostPlugin, TransformedContent } from '../index';

type Loaders = 'js' | 'jsx' | 'ts' | 'tsx';

interface esbuildOptions {
  /** File types which esbuild should handle */
  loaders?: Loaders[] | Record<string, Loaders>;

  /**
   * Factory function to use with JSX
   * @default React.createElement
   */
  jsxFactory?: string;
  /**
   * JSX fragment
   * @default React.Fragment
   */
  jsxFragment?: string;
  /** ECMAScript version to target */
  target?: Target;
}

let esbuildService: esbuild.Service;
export const esbuildPluginName = 'core-esbuild-plugin';
const esbuildPlugin = (options?: esbuildOptions): ReboostPlugin => {
  let loaderMap = {} as Record<string, Loaders>;

  if (Array.isArray(options.loaders)) {
    options.loaders.forEach((loader) => {
      loaderMap[`.${loader}`] = loader;
    });
  } else if (typeof options.loaders === 'object') {
    loaderMap = options.loaders;
  } else {
    loaderMap = {
      '.js': 'jsx',
      '.jsx': 'jsx',
      '.ts': 'tsx',
      '.tsx': 'tsx'
    }
  }

  const matcher = new RegExp(`(${Object.keys(loaderMap).map((ext) => ext.replace(/\./g, '\\.')).join('|')})$`);

  return {
    name: esbuildPluginName,
    async setup() {
      esbuildService = await esbuild.startService();
    },
    async transformContent(code, filePath) {
      const match = filePath.match(matcher);

      if (match) {
        try {
          const { js, jsSourceMap } = await esbuildService.transform(code, {
            sourcemap: true,
            loader: loaderMap[match[0]],
            jsxFactory: options.jsxFactory,
            jsxFragment: options.jsxFragment,
            target: options.target
          });

          return {
            code: js,
            map: jsSourceMap
          } as TransformedContent;
        } catch (e) {
          console.log('esbuild error', e);
        }
      }
      return null;
    }
  }
}

export { esbuildPlugin as esbuild }
