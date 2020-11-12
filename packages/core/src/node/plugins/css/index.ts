import postcss, { CssSyntaxError, ProcessOptions } from 'postcss';
import { RawSourceMap } from 'source-map';
import { codeFrameColumns } from '@babel/code-frame';

import path from 'path';

import { ReboostPlugin } from '../../index';
import { merge } from '../../utils';
import { generateModuleCode, getPlugins, Modes, runtimeCode } from './generator';
import { hasImportsIn, hasURLsIn } from './parsers';

interface ModuleOptions {
  mode: Modes | ((filePath: string) => Modes);
  exportGlobals: boolean;
  test: RegExp | ((filePath: string) => boolean);
}

export type URLTester = (url: string, filePath: string) => boolean;
export interface CSSPluginOptions {
  import?: boolean | URLTester;
  url?: boolean | URLTester;
  modules?: boolean | ModuleOptions;
  sourceMap?: boolean;
}

const isCssSyntaxError = (e: Error): e is CssSyntaxError => e.name === 'CssSyntaxError';

export const PluginName = 'core-css-plugin';
export const CSSPlugin = (options: CSSPluginOptions = {}): ReboostPlugin => {
  const defaultModuleOptions = (): Required<ModuleOptions> => ({
    mode: 'local',
    exportGlobals: false,
    test: /\.module\./i
  });
  const defaultOptions = (): Required<CSSPluginOptions> => ({
    import: true,
    url: true,
    modules: defaultModuleOptions(),
    sourceMap: true
  });
  options = merge(defaultOptions(), options);
  const modsEnabled = options.modules !== false;
  const moduleOptions: ModuleOptions = (typeof options.modules === 'object' ? options.modules : defaultModuleOptions());

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
        const isModule = modsEnabled && (
          typeof moduleOptions.test === 'function' ? moduleOptions.test(filePath) : moduleOptions.test.test(filePath)
        );
        const hasImports = options.import && hasImportsIn(css);
        const hasURLs = options.url && hasURLsIn(css);
        const processOptions: ProcessOptions = {
          from: filePath,
          to: filePath,
          map: {
            inline: false,
            annotation: false
          }
        };

        if (isModule || hasImports || hasURLs) {
          return new Promise((resolve) => {
            const { plugins, extracted } = getPlugins({
              filePath,
              handleImports: hasImports,
              handleURLS: hasURLs,
              testers: {
                import: typeof options.import === 'function' ? options.import : () => true,
                url: typeof options.url === 'function' ? options.url : () => true
              },
              module: isModule && {
                mode: typeof moduleOptions.mode === 'function'
                  ? (moduleOptions.mode(filePath) || (defaultModuleOptions().mode as Modes))
                  : moduleOptions.mode,
                exportGlobals: moduleOptions.exportGlobals,
                hasValues: /@value/i.test(css)
              }
            });

            const handleError = (err: Error) => {
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
            }
            
            postcss(plugins).process(css, processOptions).then(async (result) => {
              let cssSourceMap;
              if (options.sourceMap) {
                const generatedMap = result.map.toJSON() as any as RawSourceMap;

                // Sources are relative to the file, but they should be absolute or relative to `config.rootDir`
                generatedMap.sources = generatedMap.sources.map((sourcePath) => (
                  path.join(path.dirname(filePath), sourcePath)
                ));

                cssSourceMap = this.getCompatibleSourceMap(
                  map ? await this.mergeSourceMaps(map, generatedMap) : generatedMap
                );
              }

              resolve({
                code: generateModuleCode({
                  filePath,
                  css: result.css,
                  config: this.config,
                  sourceMap: cssSourceMap,
                  imports: extracted.imports,
                  urls: extracted.urls,
                  module: isModule && { icss: extracted.icss }
                })
              });
            }, handleError).catch(handleError);
          });
        }

        // The file is a normal CSS file with no imports or url functions
        return {
          code: generateModuleCode({
            filePath,
            css,
            config: this.config,
            sourceMap: this.getCompatibleSourceMap(
              // Use default source map if `map` is not available
              map || new this.MagicString(css).generateMap({ source: filePath })
            ),
            imports: [],
            urls: [],
            module: false
          })
        }
      }

      return null;
    }
  }
}
