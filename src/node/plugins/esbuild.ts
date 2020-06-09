import esbuild, { Target, Loader } from 'esbuild';

import { ReboostPlugin } from '../index';
import { merge } from '../utils';

export interface esbuildPluginOptions {
  /** Loaders to use for file types */
  loaders?: Record<string, Loader>;
  /** Options for JSX */
  jsx?: {
    /**
     * Factory function to use for creating elements
     * @default React.createElement
     */
    factory?: string;
    /**
     * Component to use as the fragment component
     * @default React.Fragment
     */
    fragment?: string;
  }
  /** ECMAScript version to target */
  target?: Target;
  /**
   * Minify code
   * @default true
   */
  minify?: boolean;
  /** Define values of variables */
  define?: Record<string, string>;
}

let esbuildService: esbuild.Service;

export const PluginName = 'core-esbuild-plugin';
export const esbuildPlugin = (options: esbuildPluginOptions = {}): ReboostPlugin => {
  const defaultOptions: Required<esbuildPluginOptions> = {
    loaders: {
      js: 'jsx',
      jsx: 'jsx',
      mjs: 'jsx',
      es6: 'jsx',
      es: 'jsx',
      ts: 'tsx',
      tsx: 'tsx'
    },
    jsx: {
      factory: 'React.createElement',
      fragment: 'React.Fragment'
    },
    target: 'es2019',
    minify: true,
    define: {
      'process.env.NODE_ENV': '"development"'
    }
  };
  let compatibleTypes: string[];

  return {
    name: PluginName,
    async setup({ config }) {
      if (!esbuildService) esbuildService = await esbuild.startService();

      defaultOptions.minify = !config.debugMode;
      options = merge(defaultOptions, options);
      compatibleTypes = Object.keys(options.loaders);
    },
    async transformContent(data, filePath) {
      if (compatibleTypes.includes(data.type)) {
        try {
          const { js, jsSourceMap } = await esbuildService.transform(data.code, {
            sourcemap: 'external',
            sourcefile: filePath,
            loader: options.loaders[data.type],
            jsxFactory: options.jsx.factory,
            jsxFragment: options.jsx.fragment,
            target: options.target,
            minify: options.minify,
            define: options.define
          });

          return {
            code: js,
            map: JSON.parse(jsSourceMap),
            type: 'js'
          }
        } catch (e) {
          console.log('esbuild error', e);
        }
      }

      return null;
    }
  }
}
