import * as esbuild from 'esbuild';

import path from 'path';

import { ReboostPlugin } from '../index';
import { merge } from '../utils';

export interface esbuildPluginOptions {
  /** Loaders to use for file types */
  loaders?: Record<string, esbuild.Loader>;
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
  target?: esbuild.Target;
  /**
   * Minify code
   * @default true
   */
  minify?: boolean;
  /** Define values of variables */
  define?: Record<string, string>;
}

let esbuildServicePromise: Promise<esbuild.Service>;

export const PluginName = 'core-esbuild-plugin';
export const esbuildPlugin = (options: esbuildPluginOptions = {}): ReboostPlugin => {
  const defaultOptions: Required<esbuildPluginOptions> = {
    loaders: {
      js: 'tsx',
      jsx: 'tsx',
      mjs: 'tsx',
      es6: 'tsx',
      es: 'tsx',
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
      if (!esbuildServicePromise) esbuildServicePromise = esbuild.startService();

      defaultOptions.minify = !config.debugMode;
      options = merge(defaultOptions, options);
      compatibleTypes = Object.keys(options.loaders);

      // TODO: Remove in future releases
      const aOpts = options as esbuildPluginOptions & { jsxFactory: string; jsxFragment: string; };
      if (aOpts.jsxFactory) aOpts.jsx.factory = aOpts.jsxFactory;
      if (aOpts.jsxFragment) aOpts.jsx.fragment = aOpts.jsxFragment;
    },
    async transformContent(data, filePath) {
      if (compatibleTypes.includes(data.type)) {
        try {
          const esbuildService = await esbuildServicePromise;

          const { js, jsSourceMap, warnings } = await esbuildService.transform(data.code, {
            sourcemap: 'external',
            sourcefile: path.relative(this.config.rootDir, filePath),
            loader: options.loaders[data.type],
            jsxFactory: options.jsx.factory,
            jsxFragment: options.jsx.fragment,
            target: options.target,
            minify: options.minify,
            define: options.define
          });

          warnings.forEach(({ location: { line, column, lineText, file }, text }) => {
            let msg = `esbuild: Warning "${file}"\n\n`;
            msg += `(${line}:${column}) ${text}\n`;
            msg += `| ${lineText}`;
            console.log(this.chalk.yellow(msg));
          });

          return {
            code: js,
            map: JSON.parse(jsSourceMap),
            type: 'js'
          }
        } catch (e) {
          const error = e.errors[0] as esbuild.Message;
          let msg = `esbuildPlugin: Error when processing "${error.location.file}"\n`;
          msg += `${error.text} on line ${error.location.line} at column ${error.location.column}\n\n`;
          msg += `| ${error.location.lineText}`;

          return new Error(msg);
        }
      }

      return null;
    }
  }
}
