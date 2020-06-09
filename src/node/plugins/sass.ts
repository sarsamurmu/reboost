import chalk from 'chalk';
import type Sass from 'node-sass';

import path from 'path';

import { ReboostPlugin } from '../index';
import { resolveModule } from './defaults/resolver';

interface SassPluginOptions {
  sassOptions?: Sass.Options;
}

export const SassPlugin = (options: SassPluginOptions = {}): ReboostPlugin => {
  const sassOptions = Object.assign({}, options.sassOptions);
  let includePathsNormalized = false;
  let sass: typeof Sass;
  let isNodeSass = false;
  
  return {
    name: 'core-sass-plugin',
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
          const nodeSassPath = resolveModule(process.cwd(), 'node-sass', { mainFields: ['main'] });

          if (nodeSassPath) {
            sass = require(nodeSassPath);
            isNodeSass = true;
          } else {
            const sassPath = resolveModule(process.cwd(), 'sass', { mainFields: ['main'] });
            if (sassPath) sass = require(sassPath);
          }
        }

        if (!sass) {
          console.log(chalk.red('You need to install "node-sass" package in order to use SassPlugin.'));
          console.log(chalk.red('Please run "npm i node-sass" to install node-sass.'));
          return;
        }

        return new Promise((resolve) => {
          const renderOptions = Object.assign(
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

          const handleError = (err: any, retry: boolean) => {
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

          const handleResult = (result: Sass.Result) => {
            result.stats.includedFiles.forEach((includedFile) => {
              const normalizedPath = path.normalize(includedFile);
              this.addDependency(normalizedPath);
            });

            resolve({
              code: result.css.toString(),
              map: JSON.parse(result.map.toString()),
              type: 'css'
            });
          }

          function renderAndResolve(retry: boolean) {
            if (isNodeSass) {
              sass.render(renderOptions, (err, result) => {
                if (err) {
                  return handleError(err, retry);
                }

                handleResult(result);
              });
            } else {
              try {
                // In `sass` renderSync is fast
                const result = sass.renderSync(renderOptions);

                handleResult(result);
              } catch (err) {
                handleError(err, retry);
              }
            }
          }

          renderAndResolve(true);
        });
      }

      return null;
    }
  }
}
