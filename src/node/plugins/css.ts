import postcss from 'postcss';
import localByDefault from 'postcss-modules-local-by-default';
import extractImports from 'postcss-modules-extract-imports';
import moduleValues from 'postcss-modules-values';
import moduleScope from 'postcss-modules-scope';
import { extractICSS, ExtractedICSS } from 'icss-utils';

import path from 'path';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';

type Modes = 'local' | 'global' | 'pure';

interface ModuleOptions {
  mode: Modes | ((filePath: string) => Modes);
  exportGlobals: boolean;
  test: RegExp;
}

interface CSSPluginOptions {
  modules?: boolean | ModuleOptions;
  sourceMap?: boolean;
}

const camelCase = (string: string) => string.replace(/(?:^\w|[A-Z]|\b\w)/g, (match, index) => {
  return index === 0 ? match.toLowerCase() : match.toUpperCase();
}).replace(/(\s|-|_)+/g, '');

const idMap = new Map();
let idIndex = 0;

const getID = (key: string) => {
  if (!idMap.has(key)) idMap.set(key, idIndex++);
  return idMap.get(key);
}

export const PluginName = 'core-css-plugin';
export const CSSPlugin = (options: CSSPluginOptions = {}): ReboostPlugin => {
  const modsEnabled = options.modules !== false;
  const defaultOptions = {
    mode: 'local' as Modes,
    exportGlobals: false,
    test: /\.module\./i
  }
  const modsOptions: ModuleOptions = (typeof options.modules === 'object' ? options.modules : defaultOptions);
  const sourceMapEnabled = typeof options.sourceMap === 'undefined' ? true : options.sourceMap;

  return {
    name: PluginName,
    transformIntoJS(data, filePath) {
      if (data.type === 'css') {
        const { code: css, map } = data;
        const isModule = modsEnabled && modsOptions.test.test(filePath);
        const mode = typeof modsOptions.mode === 'function'
                      ? (modsOptions.mode(filePath) || defaultOptions.mode)
                      : modsOptions.mode;

        const modulePlugins = [
          moduleValues(),
          localByDefault({ mode }),
          extractImports(),
          moduleScope({
            generateScopedName: (exportedName: string) => `_${exportedName}_${getID(exportedName + filePath)}_`,
            exportGlobals: modsOptions.exportGlobals
          } as any),
        ]

        return new Promise((resolve) => {
          let extractedICSS: ExtractedICSS;

          postcss([
            ...(isModule ? modulePlugins : []),
            postcss.plugin('import-export-extractor', () => (root) => {
              extractedICSS = extractICSS(root, true);
            })
          ]).process(css, {
            from: filePath,
            map: {
              inline: false,
              annotation: false
            }
          }).then(async (result) => {
            const localNameMap = {} as Record<string, string>;
            const importedClassMap = {} as Record<string, { from: string; name: string; }>;
            const { icssImports, icssExports } = extractedICSS;
            let script = '';

            Object.keys(icssExports).forEach((key, _, keys) => {
              const camelCased = camelCase(key);
              if (!keys.includes(camelCased)) icssExports[camelCased] = icssExports[key];
            });

            let importedIndex = 0;
            for (const key in icssImports) {
              const localName = 'styles_' + importedIndex++;
              localNameMap[key] = localName;
              script += `import ${localName} from '${key}';\n`;

              for (const className in icssImports[key]) {
                importedClassMap[className] = {
                  from: key,
                  name: icssImports[key][className]
                }
              }
            }

            let cssString = `\n/* ${path.relative(getConfig().rootDir, filePath).replace(/\\/g, '/')} */\n\n`;
            cssString += result.css;
            if (sourceMapEnabled) {
              const generatedMap = result.map.toJSON() as any;
              const sourceMap = map ? await this.mergeSourceMaps(map, generatedMap) : generatedMap;
              const sourceMapStr = JSON.stringify(this.getCompatibleSourceMap(sourceMap));
              cssString += '\n\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
              cssString += Buffer.from(sourceMapStr).toString('base64');
              cssString += ' */';
            }

            script += `
              import { hot } from 'reboost/hmr';

              let styleTag = document.createElement('style');
              let __styleTag;
              styleTag.innerHTML = ${JSON.stringify(cssString)};

              if (!hot.data) {
                document.head.appendChild(styleTag);
              } else {
                __styleTag = styleTag;
              }

              hot.self.accept((updatedMod) => {
                styleTag.replaceWith(updatedMod.__styleTag);
                styleTag = updatedMod.__styleTag;
              });

              export { __styleTag }
            `;

            if (isModule) {
              script += 'export default ' + JSON.stringify(icssExports, null, 2).replace(/"(.*)":\s?"(.*)"/g, (match, p1: string, p2: string, offset, string) => {
                const transformed = p2.split(' ').map((className) => {
                  const classNameData = importedClassMap[className];
                  if (classNameData) {
                    return `\${${localNameMap[classNameData.from]}[${JSON.stringify(classNameData.name)}]}`;
                  }

                  return className;
                }).join(' ');

                return `"${p1}": \`${transformed}\``;
              });
            }

            resolve({
              code: script
            });
          })
        });
      }

      return null;
    }
  }
}
