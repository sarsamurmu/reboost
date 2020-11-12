import type Sass from 'node-sass';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace SassPlugin {
  export interface Options {
    sassOptions?: Sass.SyncOptions;
  }
}

function SassPlugin(options: SassPlugin.Options = {}): ReboostPlugin {
  const sassOptions = Object.assign({}, options.sassOptions);
  let includePathsNormalized = false;
  let sass: typeof Sass;

  return {
    name: 'sass-plugin',
    transformContent(data, filePath) {
      if (!includePathsNormalized) {
        sassOptions.includePaths = (sassOptions.includePaths || []).map((includePath) => {
          return path.isAbsolute(includePath) ? includePath : path.join(this.config.rootDir, includePath);
        });
        includePathsNormalized = true;
      }

      if (['sass', 'scss'].includes(data.type)) {
        // Prefer `node-sass` over `sass`
        if (!sass) {
          const nodeSassPath = this.resolve(__filename, 'node-sass', {
            mainFields: ['main']
          });

          if (nodeSassPath) {
            sass = require(nodeSassPath);
          } else {
            const sassPath = this.resolve(__filename, 'sass', {
              mainFields: ['main']
            });
            if (sassPath) sass = require(sassPath);
          }
        }

        if (!sass) {
          console.log(this.chalk.red('You need to install "node-sass" package in order to use SassPlugin.'));
          console.log(this.chalk.red('Please run "npm i node-sass" to install node-sass.'));
          return;
        }

        return new Promise((resolve) => {
          type OptT = Sass.SyncOptions;
          const renderOptions = Object.assign<OptT, OptT, OptT>(
            {
              // Default options
              outputStyle: 'expanded',
              sourceMap: true
            },
            sassOptions,
            {
              file: filePath,
              data: data.code,
              indentedSyntax: data.type === 'sass',
              includePaths: [path.dirname(filePath), ...sassOptions.includePaths],
              outFile: 'out.css',
              omitSourceMapUrl: true,
              sourceMapContents: false,
              sourceMapEmbed: false,
              sourceMapRoot: undefined
            }
          );

          const renderAndResolve = (retry: boolean): any => {
            try {
              // In `sass` renderSync is fast
              const result = sass.renderSync(renderOptions);

              result.stats.includedFiles.forEach((includedFile) => {
                this.addDependency(includedFile);
              });

              resolve({
                code: result.css.toString(),
                map: JSON.parse(result.map.toString()),
                type: 'css'
              });
            } catch (err) {
              if (retry) {
                /*
                  Dirty check message
                  `File to import not found or unreadable`
                  If this (^^^) is our error message then try again
                 */
                if (err.message.includes('unreadable')) {
                  /*
                    Error `File to import not found or unreadable` occurs when
                    Sass tries to read the file and code editor (like VSCode)
                    didn't complete write finish. Try to render again in 200ms
                   */
                  return setTimeout(() => renderAndResolve(false), 200);
                }
              }

              let errorMessage = `SassPlugin: Error while processing "${filePath}"\n`;
              errorMessage += (err as any).formatted;

              const normalizedPath = path.normalize(err.file);
              if (filePath !== normalizedPath) this.addDependency(normalizedPath);

              return resolve(new Error(errorMessage));
            }
          }

          renderAndResolve(true);
        });
      }

      return null;
    }
  }
}

export = SassPlugin;
