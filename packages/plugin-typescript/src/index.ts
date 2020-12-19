import { CompilerOptions, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import loadConfig from 'tsconfig-loader';

import fs from 'fs';
import path from 'path';

import { RawSourceMap, ReboostPlugin } from 'reboost';

declare namespace TypeScriptPlugin {
  export interface Options {
    /** Path to tsconfig.json file */
    tsconfig?: string;
    /** File types to compile */
    compatibleTypes?: string[]
  }
}

function TypeScriptPlugin(options: TypeScriptPlugin.Options = {}): ReboostPlugin {
  let compilerOptions: CompilerOptions;

  const defaultCompilerOptions: CompilerOptions = {
    target: ScriptTarget.ES2020,
    module: ModuleKind.ES2020,
    experimentalDecorators: true,
  }

  return {
    name: 'typescript-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(compilerOptions),
    setup({ config }) {
      if (!options.tsconfig) {
        const defaultTSConfigPath = path.join(config.rootDir, './tsconfig.json');
        if (fs.existsSync(defaultTSConfigPath)) {
          options.tsconfig = defaultTSConfigPath;
        }
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
            : 0) ?? defaultCompilerOptions.module) as any;
        }
      }

      if (!compilerOptions) compilerOptions = defaultCompilerOptions;
      if (!options.compatibleTypes) options.compatibleTypes = ['ts'];

      Object.assign<any, CompilerOptions>(compilerOptions, {
        inlineSourceMap: false,
        inlineSources: false,
        removeComments: true,
        sourceMap: true,
      });
    },
    transformContent({ code, type }, filePath) {
      // ? Should we care about `include` and `exclude` field

      if (options.compatibleTypes.includes(type)) {
        const { sourceMapText, outputText } = transpileModule(code, { compilerOptions });

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
