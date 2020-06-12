import loadConfig from 'postcss-load-config';
import postcss, { ProcessOptions } from 'postcss';
import { codeFrameColumns } from '@babel/code-frame';
import chalk from 'chalk';

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

interface PostCSSPluginOptions {
  ctx?: Record<string, any>;
}

export const PluginName = 'core-postcss-plugin';
export const PostCSSPlugin = (options: PostCSSPluginOptions = {}): ReboostPlugin => ({
  name: PluginName,
  transformContent(data, filePath) {
    if (data.type === 'css') {
      return new Promise((resolve) => {
        const loadConfigOptions = {
          path: path.dirname(filePath),
          ctx: {
            file: {
              extname: path.extname(filePath),
              dirname: path.dirname(filePath),
              basename: path.basename(filePath)
            },
            options: {},
            env: 'development'
          }
        }

        if (options.ctx) loadConfigOptions.ctx.options = options.ctx;

        loadConfig(
          loadConfigOptions.ctx,
          loadConfigOptions.path,
          {
            stopDir: this.config.rootDir
          }
        ).then(({ plugins, options }) => {
          postcss(plugins)
            .process(data.code, Object.assign(
              {},
              options,
              {
                from: filePath,
                to: filePath,
                map: {
                  inline: false,
                  annotation: false
                }
              } as ProcessOptions
            ))
            .then((result) => {
              const { css, map, warnings, messages } = result;

              try {
                warnings().forEach((warning) => {
                  const { text, line, column } = warning;
                  console.log(chalk.yellow(`PostCSS: Warning "${path.relative(this.config.rootDir, filePath)}"\n\n(${line}:${column}) ${text}`));
                });
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
            }, (err) => {
              resolve(postcssError('PostCSSPlugin', err, this.config));
            })
        });
      });
    }

    return null;
  }
})
