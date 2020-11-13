// @ts-expect-error No declarations available, it's not really necessary
import * as malina from 'malinajs';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace MalinaJSPlugin {
  export interface Options {
    compilerOptions?: {
      warning: boolean;
      inlineTemplate: boolean;
      hideLabel: boolean;
      compact: boolean;
      autoSubscribe: boolean;
    }
  }
}

function MalinaJSPlugin(options: MalinaJSPlugin.Options = {}): ReboostPlugin {
  type Warning = { message: string };
  const compatibleTypes = ['html', 'ma', 'xht'];
  const warningsStack: Warning[][] = [];
  let compiler: { compile: () => string };

  if (options.compilerOptions && options.compilerOptions.warning) {
    (options.compilerOptions.warning as any) = (warning: Warning) => {
      warningsStack[warningsStack.length - 1].push(warning);
    }
  }

  return {
    name: 'malina-plugin',
    transformContent(data, filePath) {
      if (compatibleTypes.includes(data.type)) {
        if (!compiler) {
          const malinaPath = this.resolve(__filename, 'malinajs');
          if (malinaPath) {
            compiler = require(malinaPath);
          } else {
            console.log(this.chalk.red('You need to install "malinajs" package in order to use MalinaPlugin.'));
            console.log(this.chalk.red('Please run "npm i malinajs" to install Malina.js.'));
            return;
          }
        }

        try {
          warningsStack.push([]);
          const code = malina.compile(data.code, options.compilerOptions);

          warningsStack.pop().forEach(({ message }) => {
            console.log(this.chalk.yellow(`MalinaJSPlugin: Warning ${path.relative(this.config.rootDir, filePath)}\n\n${message}`));
          });

          return {
            code: code,
            map: undefined,
            type: 'js'
          }
        } catch (e) {
          if (e.details) {
            let message = `MalinaJSPlugin: Error while compiling ${path.relative(this.config.rootDir, filePath)}\n\n`;
            message += e.message + '\n\n';
            message += `Details: ${e.details}`;
            return new Error(message);
          }
          console.error(e);
        }
      }
    }
  }
}

export = MalinaJSPlugin;
