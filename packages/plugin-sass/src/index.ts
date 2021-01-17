import type Sass from 'node-sass';

import fs from 'fs';
import path from 'path';

import { PluginContext, ReboostPlugin } from 'reboost';

declare namespace SassPlugin {
  export interface Options {
    sassOptions?: Sass.SyncOptions;
  }
}

function SassPlugin(options: SassPlugin.Options = {}): ReboostPlugin {
  const sassOptions = Object.assign({}, options.sassOptions);
  let sass: typeof Sass;
  let sassVersion: string;

  const loadSass = (resolve: PluginContext['resolve'], chalk: PluginContext['chalk']) => {
    if (!sass) {
      try {
        // Note: Prefer `node-sass` over `sass`
        try {
          sass = require(resolve(__filename, 'node-sass', { mainFields: ['main'] }));
          sassVersion = JSON.parse(
            fs.readFileSync(resolve(__filename, 'node-sass/package.json'), 'utf8')
          ).version;
        } catch (e) {
          sass = require(resolve(__filename, 'sass', { mainFields: ['main'] }));
          sassVersion = JSON.parse(
            fs.readFileSync(resolve(__filename, 'sass/package.json'), 'utf8')
          ).version;
        }
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "node-sass" package in order to use SassPlugin.\n' +
            'Please run "npm i node-sass" to install node-sass.'
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
    name: 'sass-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(options) + `@v${sassVersion}`,
    setup({ config, chalk, resolve }) {
      sassOptions.includePaths = (sassOptions.includePaths || []).map((includePath) => {
        return path.isAbsolute(includePath) ? includePath : path.join(config.rootDir, includePath);
      });

      loadSass(resolve, chalk);
    },
    transformContent(data, filePath) {
      if (['sass', 'scss'].includes(data.type)) {
        if (!loadSass(this.resolve, this.chalk)) return;

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
