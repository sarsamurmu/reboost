import chalk from 'chalk';
import type Sass from 'node-sass';

import path from 'path';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';

interface SassPluginOptions {
  sassOptions?: Sass.Options;
}

export const SassPlugin = (options: SassPluginOptions = {}): ReboostPlugin => {
  const sassOptions = Object.assign({}, options.sassOptions);
  sassOptions.includePaths = (sassOptions.includePaths || []).map((includePath) => {
    return path.isAbsolute(includePath) ? includePath : path.resolve(getConfig().rootDir, includePath)
  });
  
  return {
    name: 'core-sass-plugin',
    transformContent(data, filePath) {
      if (['sass', 'scss'].includes(data.type)) {
        try {
          const nodeSassPath = require.resolve('node-sass', { paths: [process.cwd()] });
          const sass: typeof Sass = require(nodeSassPath);

          return new Promise((resolve) => {
            const renderAndResolve = (retry = true) => {
              sass.render(Object.assign(
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
              ), (err, result) => {
                if (err) {
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
                  console.log(chalk.red(`SassPlugin: Error with file "${filePath}"\n`));
                  console.log(chalk.red((err as any).formatted));
                  return resolve();
                }

                result.stats.includedFiles.forEach((includedFile) => {
                  const normalizedPath = path.normalize(includedFile);
                  this.addDependency(normalizedPath);
                });

                resolve({
                  code: result.css.toString(),
                  map: JSON.parse(result.map.toString()),
                  type: 'css'
                });
              });
            }

            renderAndResolve();
          });
        } catch (e) {
          if (e.code === 'MODULE_NOT_FOUND') {
            console.log(chalk.red('You need to install "node-sass" package in order to use SassPlugin.'));
            console.log(chalk.red('Please run "npm i node-sass" to install node-sass.'));
          } else {
            console.error(e);
          }
        }
      }

      return null;
    }
  }
}
