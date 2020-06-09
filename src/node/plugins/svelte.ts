import SvelteCompiler from 'svelte/compiler';
import chalk from 'chalk';
import { RawSourceMap } from 'source-map';
import MagicString from 'magic-string';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';
import { resolveModule } from './defaults/resolver';

interface SveltePluginOptions {
  configFile?: string;
  preprocess?: any;
}

export const SveltePlugin = (options: SveltePluginOptions = {}): ReboostPlugin => {
  let sveltePath: string;
  let configFile: string;
  let svelteConfig = {} as Record<string, any>;

  return {
    name: 'core-svelte-plugin',
    async transformContent(data, filePath) {
      if (data.type === 'svelte') {
        if (!sveltePath) sveltePath = resolveModule(process.cwd(), 'svelte/compiler', { mainFields: ['main'] });

        if (!sveltePath) {
          console.log(chalk.red('You need to install "svelte" package in order to use SveltePlugin.'));
          console.log(chalk.red('Please run "npm i svelte" to install svelte.'));
          return;
        }

        if (!configFile) {
          configFile = options.configFile || './svelte.config.js';
          if (!path.isAbsolute(configFile)) configFile = path.join(this.config.rootDir, configFile);
          if (fs.existsSync(configFile)) {
            svelteConfig = require(configFile);
          }
        }

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
          const normalizedPath = path.normalize(absolutePath);
          this.addDependency(normalizedPath);
        });

        let {
          js: { code, map },
          warnings
        }: {
          js: { code: string; map: RawSourceMap; }
          warnings: { toString(): string; }[]
        } = Compiler.compile(processedCode, {
          dev: true,
          ...svelteConfig,
          filename: filePath,
        });

        warnings.forEach((warning) => {
          console.log(chalk.yellow(`\nWarning: ${path.relative(this.config.rootDir, filePath)}\n\n${warning.toString()}\n`));
        });

        // Replace the source map for CSS
        const regex = /\/\*#\s*sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(.*)\s*\*\//;
        const match = code.match(regex);
        if (match) {
          let replacePromise: Promise<any>;
          let replacement: string;

          code.replace(
            regex,
            ((match: any, p1: string, offset: any, string: any) => {
              replacePromise = (async () => {
                const sourceMap = JSON.parse(Buffer.from(p1, 'base64').toString()) as RawSourceMap;

                sourceMap.sources = sourceMap.sources.map((sourcePath) => {
                  return sourcePath === path.basename(filePath) ? filePath : sourcePath;
                });

                const mergedMap = data.map ? await this.mergeSourceMaps(data.map, sourceMap) : sourceMap;
                const compatibleMap = this.getCompatibleSourceMap(mergedMap);
                const sourceMapStr = Buffer.from(JSON.stringify(compatibleMap)).toString('base64');
                return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMapStr} */`;
              })();
            }) as any
          );

          replacement = await replacePromise;

          const magicString = new MagicString(code);
          magicString.overwrite(match.index, match.index + match[0].length, replacement);
          map = await this.mergeSourceMaps(magicString.generateMap(), map);
          code = magicString.toString();
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
