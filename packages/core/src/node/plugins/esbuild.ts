import * as esbuild from 'esbuild';

import { ReboostPlugin } from '../index';
import { merge } from '../utils';

declare namespace esbuildPlugin {
  export interface Options {
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
    target?: 'esnext' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020';
    /**
     * Minify code
     * @default true
     */
    minify?: boolean | {
      syntax: boolean;
      whitespace: boolean;
    };
    /**
     * Define values of variables
     * @example { 'process.env.NODE_ENV': '"development"' }
     */
    define?: Record<string, string>;
    /** Pre-started service to use with esbuild */
    service?: esbuild.Service;
  }
}

const PluginName = 'core-esbuild-plugin';
function esbuildPlugin(options: esbuildPlugin.Options = {}): ReboostPlugin {
  const defaultOptions: Required<esbuildPlugin.Options> = {
    loaders: {
      js: 'ts',
      jsx: 'tsx',
      mjs: 'ts',
      cjs: 'ts',
      es6: 'ts',
      es: 'ts',
      ts: 'ts',
      tsx: 'tsx'
    },
    jsx: {
      factory: 'React.createElement',
      fragment: 'React.Fragment'
    },
    target: 'es2020',
    minify: true,
    define: undefined,
    service: undefined,
  };
  let compatibleTypes: string[];
  let esbuildService: esbuild.Service;
  let minifyOptions: Exclude<esbuildPlugin.Options['minify'], boolean>;
  const loadService = async () => {
    if (!esbuildService) {
      if (options.service) {
        esbuildService = options.service;
      } else {
        esbuildService = await esbuild.startService();
      }
    }
    return esbuildService;
  }

  return {
    name: PluginName,
    setup({ config, chalk }) {
      loadService();

      defaultOptions.minify = !config.debugMode;
      options = merge(defaultOptions, options);
      compatibleTypes = Object.keys(options.loaders);
      const minifyOption = (key: keyof typeof minifyOptions) => (
        typeof options.minify === 'object' ? options.minify[key] : options.minify
      );
      minifyOptions = {
        syntax: minifyOption('syntax'),
        whitespace: minifyOption('whitespace')
      }

      // TODO: Remove in v1.0
      const aOpts = options as esbuildPlugin.Options & { jsxFactory: string; jsxFragment: string; };
      const showWarning = (oldOpt: string, newOpt: string) => {
        if (!config.log) return;
        let message = `esbuildPlugin: options.${oldOpt} is deprecated and will be removed in next major release. `;
        message += `Use options.${newOpt} instead.`;
        console.log(chalk.yellow(message));
      }
      if (aOpts.jsxFactory) {
        showWarning('jsxFactory', 'jsx.factory');
        aOpts.jsx.factory = aOpts.jsxFactory;
      }
      if (aOpts.jsxFragment) {
        showWarning('jsxFragment', 'jsx.fragment');
        aOpts.jsx.fragment = aOpts.jsxFragment;
      }
    },
    stop() {
      if (options.service) return;
      esbuildService.stop();
      esbuildService = undefined;
    },
    async transformContent(data, filePath) {
      if (compatibleTypes.includes(data.type)) {
        try {
          const { code, map, warnings } = await (await loadService()).transform(data.code, {
            sourcemap: 'external',
            sourcefile: this.rootRelative(filePath),
            loader: options.loaders[data.type],
            jsxFactory: options.jsx.factory,
            jsxFragment: options.jsx.fragment,
            target: options.target,
            minifyIdentifiers: false,
            minifySyntax: minifyOptions.syntax,
            minifyWhitespace: minifyOptions.whitespace,
            define: options.define
          });

          if (this.config.log) {
            warnings.forEach(({ location: { line, column, lineText, file }, text }) => {
              const lText = text.toLowerCase();
              if (lText.includes('unsupported source map')) return;

              let msg = `esbuild: Warning "${file}"\n\n`;
              msg += `(${line}:${column}) ${text}\n`;
              msg += `| ${lineText}`;
              
              console.log(this.chalk.yellow(msg));
            });
          }

          return {
            code,
            map: JSON.parse(map),
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

export { esbuildPlugin, PluginName }
