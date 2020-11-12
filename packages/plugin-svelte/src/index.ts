import SvelteCompiler from 'svelte/compiler';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace SveltePlugin {
  export interface Options {
    configFile?: string;
    preprocess?: any;
  }
}

function SveltePlugin(options: SveltePlugin.Options = {}): ReboostPlugin {
  let sveltePath: string;
  let configFile: string;
  let svelteConfig = {} as Record<string, any>;

  return {
    name: 'svelte-plugin',
    async transformContent(data, filePath) {
      if (data.type === 'svelte') {
        if (!sveltePath) sveltePath = this.resolve(__filename, 'svelte/compiler.js');

        if (!sveltePath) {
          console.log(this.chalk.red('You need to install "svelte" package in order to use SveltePlugin.'));
          console.log(this.chalk.red('Please run "npm i svelte" to install svelte.'));
          return;
        }

        if (!configFile) {
          configFile = options.configFile || './svelte.config.js';
          if (!path.isAbsolute(configFile)) configFile = path.join(this.config.rootDir, configFile);
          if (fs.existsSync(configFile)) {
            svelteConfig = require(configFile);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Compiler: typeof SvelteCompiler = require(sveltePath);

        const {
          code: processedCode,
          dependencies
        } = await Compiler.preprocess(
          data.code,
          options.preprocess || svelteConfig.preprocess || {},
          {
            filename: filePath
          }
        );

        dependencies.forEach((dependency) => {
          const absolutePath = path.isAbsolute(dependency) ? dependency : path.join(path.dirname(filePath), dependency);
          this.addDependency(absolutePath);
        });

        /* eslint-disable prefer-const */
        let {
          js: { code, map },
          warnings
        } = Compiler.compile(processedCode, {
          dev: true,
          ...svelteConfig,
          filename: filePath,
        });

        /* eslint-enable */

        warnings.forEach((warning) => {
          console.log(this.chalk.yellow(`Svelte: Warning "${path.relative(this.config.rootDir, filePath)}"\n\n${warning.toString()}\n`));
        });

        // Replace the source map for CSS
        const regex = /\/\*#\s*sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(.*)\s*\*\//;
        const match = code.match(regex);
        if (match) {
          let replacePromise: Promise<any>;

          code.replace(
            regex,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ((match: any, p1: string, offset: any, string: any) => {
              replacePromise = (async () => {
                const sourceMap = JSON.parse(Buffer.from(p1, 'base64').toString());

                sourceMap.sources = sourceMap.sources.map((sourcePath: string) => {
                  return sourcePath === path.basename(filePath) ? filePath : sourcePath;
                });

                const mergedMap = data.map ? await this.mergeSourceMaps(data.map, sourceMap) : sourceMap;
                const compatibleMap = this.getCompatibleSourceMap(mergedMap);
                const sourceMapStr = Buffer.from(JSON.stringify(compatibleMap)).toString('base64');
                return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMapStr} */`;
              })();
            }) as any
          );

          code = code.replace(regex, await replacePromise);
        }

        return {
          code,
          map,
          type: 'js'
        }
      }

      return null;
    }
  }
}

export = SveltePlugin;
