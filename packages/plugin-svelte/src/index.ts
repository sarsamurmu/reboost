// @ts-expect-error No need for declaration files
import { createMakeHot } from 'svelte-hmr';

import fs from 'fs';
import path from 'path';

import { PluginContext, ReboostPlugin } from 'reboost';

declare namespace SveltePlugin {
  export interface Options {
    configFile?: string;
    preprocess?: any;
    hotOptions?: any;
  }
}

function SveltePlugin(options: SveltePlugin.Options = {}): ReboostPlugin {
  let compiler: typeof import('svelte/compiler');
  let compilerVersion: string;
  let svelteConfig = {} as Record<string, any>;
  let makeHot: (data: {
    id: string;
    compiledCode: string;
    hotOptions: any;
    compiled: ReturnType<typeof compiler['compile']>;
    originalCode: string;
    compileOptions: any;
  }) => string;

  const loadSvelte = (resolve: PluginContext['resolve'], chalk: PluginContext['chalk']) => {
    if (!compiler) {
      try {
        compiler = require(resolve(__filename, 'svelte/compiler', {
          conditionNames: ['require']
        }));
        compilerVersion = JSON.parse(
          fs.readFileSync(resolve(__filename, 'svelte/package.json')).toString()
        ).version;
        makeHot = createMakeHot({
          walk: (compiler as any).walk,
          meta: 'import.meta'
        });
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "svelte" package in order to use SveltePlugin.\n' +
            'Please run "npm i svelte" to install svelte.'
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
    name: 'svelte-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject({ options, svelteConfig }) + `@v${compilerVersion}`,
    setup({ config, chalk, resolve }) {
      let configFile = options.configFile || './svelte.config.js';
      if (!path.isAbsolute(configFile)) configFile = path.join(config.rootDir, configFile);
      if (fs.existsSync(configFile)) {
        svelteConfig = require(configFile);
      }

      loadSvelte(resolve, chalk);
    },
    async transformContent(data, filePath) {
      if (data.type === 'svelte') {
        if (!loadSvelte(this.resolve, this.chalk)) return;

        const {
          code: processedCode,
          dependencies
        } = await compiler.preprocess(
          data.code,
          options.preprocess || svelteConfig.preprocess || {},
          { filename: filePath }
        );

        dependencies.forEach((dependency) => {
          const absolutePath = path.isAbsolute(dependency) ? dependency : path.join(path.dirname(filePath), dependency);
          this.addDependency(absolutePath);
        });
        
        const compileOptions: Parameters<typeof compiler['compile']>[1] = {
          dev: true,
          ...svelteConfig,
          filename: filePath,
        };
        const compiled = compiler.compile(processedCode, compileOptions);
        // eslint-disable-next-line prefer-const
        let { code, map } = compiled.js;

        compiled.warnings.forEach((warning) => {
          this.emitWarning(`SveltePlugin: Warning "${this.rootRelative(filePath)}"\n\n${warning.toString()}\n`)
        });

        code = makeHot({
          id: filePath,
          compiledCode: code,
          hotOptions: options.hotOptions,
          compiled,
          originalCode: data.code,
          compileOptions: compileOptions
        });

        // Replace the source map for CSS
        const regex = /\/\*#\s*sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(.*)\s*\*\//;
        const match = code.match(regex);
        if (match) {
          let replacePromise: Promise<any>;

          code.replace(regex, ((_: any, p1: string) => {
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
          }) as any);

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
