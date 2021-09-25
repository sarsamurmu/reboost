import type { default as PostCSS, ProcessOptions, CssSyntaxError } from 'postcss';
import { codeFrameColumns } from '@babel/code-frame';
import loadConfig from 'postcss-load-config';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin, ReboostConfig, PluginContext } from 'reboost';

const isCssSyntaxError = (e: Error): e is CssSyntaxError => e.name === 'CssSyntaxError';
const makeError = (error: Error, config: ReboostConfig) => {
  if (isCssSyntaxError(error)) {
    let errorMessage = `PostCSSPlugin: Error while processing "${path.relative(config.rootDir, error.file)}"\n`;
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
  } else {
    console.error(error);
  }
}

declare namespace PostCSSPlugin {
  export interface Options {
    /** PostCSS config context */
    ctx?: Record<string, any>;
    /** PostCSS config directory */
    path?: string;
  }
}

function PostCSSPlugin(options: PostCSSPlugin.Options = {}): ReboostPlugin {
  const cacheMap = new Map<string, loadConfig.Result>();
  let postcss: typeof PostCSS;
  let postcssVersion: string;

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

  const loadPostCSS = (resolve: PluginContext['resolve'], chalk: PluginContext['chalk']) => {
    if (!postcss) {
      try {
        postcss = require(resolve(__filename, 'postcss', { mainFields: ['main'] }));
        postcssVersion = JSON.parse(
          fs.readFileSync(resolve(__filename, 'postcss/package.json'), 'utf8')
        ).version;
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "postcss" package in order to use PostCSSPlugin.\n' +
            'Please run "npm i postcss" to install PostCSS.'
          ));
        } else {
          console.error(e);
        }
        return false;
      }
    }
    return true;
  }

  return {
    name: 'postcss-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(options) + `@v${postcssVersion}`,
    setup({ config, chalk, resolve }) {
      checkOptions(config, (err) => config.log && console.log(chalk.red(err.message)));
      loadPostCSS(resolve, chalk);
    },
    transformContent(data, filePath) {
      if (data.type === 'css') {
        if (!loadPostCSS(this.resolve, this.chalk)) return;

        return new Promise((resolve) => {
          checkOptions(this.config, (err) => resolve(err));

          const runProcess = ({ plugins, options }: loadConfig.Result) => {
            const onError = (err: any) => resolve(makeError(err, this.config));
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
                      this.emitWarning(`PostCSS: Warning "${this.rootRelative(filePath)}"\n\n(${line}:${column}) ${text}`);
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

export = PostCSSPlugin;
