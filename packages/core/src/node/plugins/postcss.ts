import loadConfig from 'postcss-load-config';
import DefaultPostCSS, { ProcessOptions } from 'postcss';
import { codeFrameColumns } from '@babel/code-frame';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin, ReboostConfig } from '../index';

export const postcssError = (pluginName: string, error: any, config: ReboostConfig) => {
  let errorMessage = `${pluginName}: Error while processing "${path.relative(config.rootDir, error.file)}"\n`;
  errorMessage += `${error.reason} on line ${error.line} at column ${error.column}\n\n`;

  errorMessage += codeFrameColumns(error.source, {
    start: {
      line: error.line,
      column: error.column
    }
  }, {
    message: error.reason
  });

  return new Error(errorMessage);
}

export interface PostCSSPluginOptions {
  /** PostCSS config context */
  ctx?: Record<string, any>;
  /** PostCSS config directory */
  path?: string;
  /** Custom PostCSS module to use for processing */
  postcss?: any;
}

export const PluginName = 'core-postcss-plugin';
export const PostCSSPlugin = (options: PostCSSPluginOptions = {}): ReboostPlugin => {
  type LoadConfigResult = Parameters<Parameters<ReturnType<typeof loadConfig>['then']>[0]>[0];
  const cacheMap = new Map<string, LoadConfigResult>();
  let postcss: typeof DefaultPostCSS;

  let optionsCheckPassed = false;
  const checkOptions = (config: ReboostConfig, onError: (error: Error) => void) => {
    if (!optionsCheckPassed && options.path) {
      if (!path.isAbsolute(options.path)) {
        options.path = path.resolve(config.rootDir, options.path);
      }

      if (fs.existsSync(options.path)) {
        if (!fs.lstatSync(options.path).isDirectory()) {
          return onError(new Error(
            'PostCSSPlugin: options.path should be a path to a directory. ' +
            `The given path is - ${options.path}`
          ));
        }
      } else {
        return onError(new Error(
          `PostCSSPlugin: The given path for options.path does not exist - ${options.path}`
        ));
      }

      optionsCheckPassed = true;
    }
  }

  return {
    name: PluginName,
    setup({ config, chalk }) {
      checkOptions(config, (err) => config.log && chalk.red(err.message));
    },
    transformContent(data, filePath) {
      if (data.type === 'css') {
        return new Promise((resolve) => {
          checkOptions(this.config, (err) => resolve(err));
          if (!postcss) postcss = options.postcss || DefaultPostCSS;

          const runProcess = ({ plugins, options }: LoadConfigResult) => {
            const onError = (err: any) => resolve(postcssError('PostCSSPlugin', err, this.config));
            type OptT = ProcessOptions;
            postcss(plugins)
              .process(data.code, Object.assign<OptT, OptT, OptT>(
                {},
                options,
                {
                  from: filePath,
                  to: filePath,
                  map: {
                    inline: false,
                    annotation: false
                  }
                }
              )).then((result) => {
                const { css, map, warnings, messages } = result;

                try {
                  if (this.config.log) {
                    warnings().forEach((warning) => {
                      const { text, line, column } = warning;
                      console.log(this.chalk.yellow(`PostCSS: Warning "${path.relative(this.config.rootDir, filePath)}"\n\n(${line}:${column}) ${text}`));
                    });
                  }
                } catch (e) {
                  // Do nothing

                  // IDK why but it was causing the following error
                  // TypeError: Cannot read property 'messages' of undefined
                  //    at warnings (<reboostDir>\node_modules\postcss\lib\result.js:181:17)
                }

                messages.forEach((message) => {
                  if (message.type === 'dependency') {
                    this.addDependency(message.file);
                  }
                });

                const sourceMap = map.toJSON();
                // Sources are relative to the file, but they should be absolute or relative to `config.rootDir`
                sourceMap.sources = sourceMap.sources.map((sourcePath) => {
                  return path.join(path.dirname(filePath), sourcePath);
                });

                resolve({
                  code: css,
                  map: sourceMap as any
                });
              }, onError).catch(onError);
          }

          const loadStartPath = options.path || path.dirname(filePath);

          if (
            cacheMap.has(loadStartPath) &&
            fs.existsSync(loadStartPath) &&
            fs.existsSync(cacheMap.get(loadStartPath).file)
          ) {
            return runProcess(cacheMap.get(loadStartPath));
          }

          const loadConfigOptions = {
            path: loadStartPath,
            ctx: {
              file: {
                extname: path.extname(filePath),
                dirname: path.dirname(filePath),
                basename: path.basename(filePath)
              },
              options: options.ctx || {},
              env: 'development'
            }
          };

          loadConfig(
            loadConfigOptions.ctx,
            loadConfigOptions.path,
            { stopDir: this.config.rootDir }
          ).then((result) => {
            cacheMap.set(loadStartPath, result);
            runProcess(result);
          }).catch((err) => {
            resolve(new Error(`PostCSSPlugin: Error when loading config file - ${err.message}`))
          });
        });
      }

      return null;
    }
  }
}
