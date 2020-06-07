import SvelteCompiler from 'svelte/compiler';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';
import { resolveModule } from './defaults/resolver';

interface SveltePluginOptions {
  configFile?: string;
}

export const SveltePlugin = (options: SveltePluginOptions = {}): ReboostPlugin => {
  let sveltePath: string;
  let configFile: string;
  let svelteConfig = {} as Record<string, any>;

  return {
    name: 'core-svelte-plugin',
    async transformContent(data, filePath) {
      if (data.type === 'svelte') {
        if (!sveltePath) sveltePath = resolveModule(process.cwd(), 'svelte/compiler', false);

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
        } = await Compiler.preprocess(data.code, svelteConfig.preprocess || {}, {
          filename: filePath
        });

        dependencies.forEach((dependency) => {
          const absolutePath = path.isAbsolute(dependency) ? dependency : path.join(path.dirname(filePath), dependency);
          const normalizedPath = path.normalize(absolutePath);
          this.addDependency(normalizedPath);
        });

        const {
          js: { code, map },
          warnings
        } = Compiler.compile(processedCode, {
          ...svelteConfig,
          filename: filePath
        });

        warnings.forEach((warning) => {
          console.log(chalk.yellow(`\nWarning: ${path.relative(this.config.rootDir, filePath)}\n\n${warning.toString()}\n`));
        });

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
