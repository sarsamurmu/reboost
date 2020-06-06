import loadConfig from 'postcss-load-config';
import postcss, { ProcessOptions } from 'postcss';
import { codeFrameColumns } from '@babel/code-frame';

import path from 'path';

import { ReboostPlugin, ReboostConfig } from '../index';

export const postcssError = (error: any, config: ReboostConfig) => {
  let errorMessage = `CSSPlugin: Error while processing "${path.relative(config.rootDir, error.file).replace(/\\/g, '/')}"\n`;
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

export const PostCSSPlugin = (): ReboostPlugin => ({
  name: 'core-postcss-plugin',
  transformContent(data, filePath) {
    if (data.type === 'css') {
      return new Promise((resolve) => {
        loadConfig({
          env: 'development'
        }).then(({ plugins, options }) => {
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
              resolve({
                code: result.css,
                map: (result.map || { toJSON: () => {} }).toJSON() as any
              });
            }, (err) => {
              resolve(postcssError(err, this.config));
            });
        });
      });
    }

    return null;
  }
})
