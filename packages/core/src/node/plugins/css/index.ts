import postcss, { CssSyntaxError } from 'postcss';
import { RawSourceMap } from 'source-map';
import { codeFrameColumns } from '@babel/code-frame';

import path from 'path';

import { ReboostPlugin } from '../../index';
import { merge } from '../../utils';
import { generateModuleCode, getPlugins, ModuleMode, runtimeCode } from './generator';

interface ModuleOptions {
  mode: ModuleMode;
  exportGlobals: boolean;
  test: RegExp;
}

export interface CSSPluginOptions {
  import?: boolean;
  modules?: boolean | ModuleOptions;
  sourceMap?: boolean;
}

const isCssSyntaxError = (e: Error): e is CssSyntaxError => e.name === 'CssSyntaxError';

export const PluginName = 'core-css-plugin';
export const CSSPlugin = (options: CSSPluginOptions = {}): ReboostPlugin => {
  const defaultModuleOptions = (): Required<ModuleOptions> => ({
    mode: 'local' as ModuleMode,
    exportGlobals: false,
    test: /\.module\./i
  });
  const defaultOptions = (): Required<CSSPluginOptions> => ({
    import: true,
    modules: defaultModuleOptions(),
    sourceMap: true
  });
  options = merge(defaultOptions(), options);
  const modsEnabled = options.modules !== false;
  const modsOptions: ModuleOptions = (typeof options.modules === 'object' ? options.modules : defaultModuleOptions());

  return {
    name: PluginName,
    setup({ proxyServer }) {
      // eslint-disable-next-line @typescript-eslint/require-await
      proxyServer.use(async (ctx) => {
        if (ctx.path === '/css-runtime') {
          ctx.type = 'text/javascript';
          ctx.body = runtimeCode;
        }
      });
    },
    transformIntoJS(data, filePath) {
      if (data.type === 'css') {
        const { code: css, map } = data;
        const isModule = modsEnabled && modsOptions.test.test(filePath);

        if (isModule) {
          return new Promise((resolve) => {
            const { plugins, extracted } = getPlugins({
              filePath,
              handleImports: options.import,
              moduleMode: typeof modsOptions.mode === 'function'
                ? (modsOptions.mode(filePath) || defaultModuleOptions().mode)
                : modsOptions.mode,
              exportGlobals: modsOptions.exportGlobals
            });
            
            postcss(plugins).process(css, {
              from: filePath,
              to: filePath,
              map: {
                inline: false,
                annotation: false
              }
            }).then(async (result) => {
              let cssSourceMap;
              if (options.sourceMap) {
                const generatedMap = result.map.toJSON() as any as RawSourceMap;

                // Sources are relative to the file, but they should be absolute or relative to `config.rootDir`
                generatedMap.sources = generatedMap.sources.map((sourcePath) => (
                  path.join(path.dirname(filePath), sourcePath)
                ));

                const sourceMap = map ? await this.mergeSourceMaps(map, generatedMap) : generatedMap;
                cssSourceMap = this.getCompatibleSourceMap(sourceMap);
              }

              const code = generateModuleCode({
                filePath,
                css: result.css,
                config: this.config,
                sourceMap: cssSourceMap,
                imports: extracted.imports,
                module: { icss: extracted.icss }
              });

              resolve({ code });
            }, (err) => {
              if (isCssSyntaxError(err)) {
                let errorMessage = `CSSPlugin: Error while processing "${path.relative(this.config.rootDir, err.file)}"\n`;
                errorMessage += `${err.reason} on line ${err.line} at column ${err.column}\n\n`;

                errorMessage += codeFrameColumns(err.source, {
                  start: {
                    line: err.line,
                    column: err.column
                  }
                }, {
                  message: err.reason
                });

                resolve(new Error(errorMessage));
              } else {
                console.error(err);
                resolve();
              }
            });
          });
        }

        const sourceMap = this.getCompatibleSourceMap(
          // Use default source map if `map` is not available
          map || new this.MagicString(css).generateMap({ source: filePath })
        );

        return {
          code: generateModuleCode({
            filePath,
            css,
            config: this.config,
            sourceMap,
            // TODO: Resolve imports of Regular CSS files
            imports: [],
            module: false
          })
        }
      }

      return null;
    }
  }
}
