// @ts-expect-error No declarations available, it's not really necessary
import * as malina from 'malinajs';

import { ReboostPlugin } from 'reboost';

declare namespace MalinaPlugin {
  export interface Options {
    compilerOptions?: {
      // TODO: Add options from the docs
    }
  }
}

function MalinaPlugin(options: MalinaPlugin.Options = {}): ReboostPlugin {
  const compatibleTypes = ['html', 'ma', 'xht'];
  let compiler: { compile: () => string };

  return {
    name: 'malina-plugin',
    transformContent(data) {
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
          return {
            code: malina.compile(data.code, options.compilerOptions),
            map: undefined,
            type: 'js'
          }
        } catch (e) {
          // TODO: Format and handle errors
          // if (e.details) console.log(e.details);
        }
      }
    }
  }
}

export = MalinaPlugin;
