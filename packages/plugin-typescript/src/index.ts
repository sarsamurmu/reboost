import type ts from 'typescript';
import loadConfig from 'tsconfig-loader';

import fs from 'fs';
import path from 'path';

import { PluginContext, RawSourceMap, ReboostPlugin } from 'reboost';

declare namespace TypeScriptPlugin {
  export interface Options {
    /** Path to tsconfig.json file */
    tsconfig?: string;
    /** File types to compile */
    compatibleTypes?: string[]
  }
}

function TypeScriptPlugin(options: TypeScriptPlugin.Options = {}): ReboostPlugin {
  let compilerOptions: ts.CompilerOptions = {};
  let compiler: typeof ts;
  let compilerVersion: string;

  const loadTypeScript = (
    resolve: PluginContext['resolve'],
    chalk: PluginContext['chalk'],
    config: PluginContext['config']
  ) => {
    if (!compiler) {
      try {
        compiler = require(resolve(__filename, 'typescript'));
        compilerVersion = JSON.parse(
          fs.readFileSync(resolve(__filename, 'typescript/package.json')).toString()
        ).version;
      } catch (e) {
        if (/resolve/i.test(e.message)) {
          console.log(chalk.red(
            'You need to install "typescript" package in order to use TypeScriptPlugin.\n' +
            'Please run "npm i typescript" to install TypeScript.'
          ));
        } else {
          console.error(e);
        }
        return false;
      }

      if (!options.tsconfig) {
        const defaultTSConfigPath = path.join(config.rootDir, './tsconfig.json');
        if (fs.existsSync(defaultTSConfigPath)) {
          options.tsconfig = defaultTSConfigPath;
        }
      }

      const { ScriptTarget, ModuleKind } = compiler;

      const defaultCompilerOptions: ts.CompilerOptions = {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ES2020,
        experimentalDecorators: true,
      }

      if (options.tsconfig) {
        const { tsConfig } = loadConfig({
          filename: path.isAbsolute(options.tsconfig)
            ? options.tsconfig
            : path.join(config.rootDir, options.tsconfig)
        });

        if (tsConfig.compilerOptions) {
          const cOpts = tsConfig.compilerOptions;
          compilerOptions = cOpts as any;
          compilerOptions.target = (
            ScriptTarget[cOpts.target.toUpperCase()] ?? defaultCompilerOptions.target
          ) as any;
          compilerOptions.module = ((/es/i.test(cOpts.module as any)
            ? ModuleKind[cOpts.module.toUpperCase()]
            : 0) || defaultCompilerOptions.module) as any;
        }
      }

      if (!compilerOptions) compilerOptions = defaultCompilerOptions;
      if (!options.compatibleTypes) options.compatibleTypes = ['ts'];

      Object.assign<any, ts.CompilerOptions>(compilerOptions, {
        inlineSourceMap: false,
        inlineSources: false,
        removeComments: true,
        sourceMap: true,
      });
    }
    return true;
  }

  return {
    name: 'typescript-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(compilerOptions) + `@v${compilerVersion}`,
    setup(data) {
      loadTypeScript(data.resolve, data.chalk, data.config);
    },
    transformContent({ code, type }, filePath) {
      // ? Should we care about `include` and `exclude` field

      if (options.compatibleTypes.includes(type)) {
        if (!loadTypeScript(this.resolve, this.chalk, this.config)) return;

        const { sourceMapText, outputText } = compiler.transpileModule(code, { compilerOptions });

        return {
          code: outputText,
          map: sourceMapText && Object.assign<any, Partial<RawSourceMap>>(JSON.parse(sourceMapText), {
            sources: [filePath]
          }),
          type: 'js'
        }
      }

      return null;
    }
  }
}

export = TypeScriptPlugin;
