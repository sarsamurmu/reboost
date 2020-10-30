import { AcceptedPlugin } from 'postcss';
import localByDefault from 'postcss-modules-local-by-default';
import extractImports from 'postcss-modules-extract-imports';
import moduleValues from 'postcss-modules-values';
import moduleScope from 'postcss-modules-scope';
import { extractICSS, ExtractedICSS } from 'icss-utils';
import { RawSourceMap } from 'source-map';

import path from 'path';

import { ReboostConfig } from '../../index';
import { ParsedImport, importParser } from './import-parser';

const camelCase = (string: string) => string.replace(/(?:^\w|[A-Z]|\b\w)/g, (match, index) => (
  index === 0 ? match.toLowerCase() : match.toUpperCase()
)).replace(/(\s|-|_)+/g, '');

let idIndex = 0;
const idMap = new Map();
const getID = (key: string) => {
  if (!idMap.has(key)) idMap.set(key, idIndex++);
  return idMap.get(key);
}

export type Modes = 'local' | 'global' | 'pure';
export const getPlugins = (options: {
  filePath: string;
  handleImports: boolean;
  module: false | {
    mode: Modes;
    exportGlobals: boolean;
  }
}) => {
  const extracted = {
    imports: [] as ParsedImport[],
    icss: undefined as ExtractedICSS
  }
  const plugins: AcceptedPlugin[] = [];

  if (options.module) {
    plugins.push(
      moduleValues(),
      localByDefault({ mode: options.module.mode }),
      extractImports(),
      moduleScope({
        generateScopedName: (exportedName) => `_${exportedName}_${getID(exportedName + options.filePath)}_`,
        exportGlobals: options.module.exportGlobals
      }),
      {
        postcssPlugin: 'icss-extractor',
        Once(root) { extracted.icss = extractICSS(root, true) }
      },
    );
  }

  if (options.handleImports) plugins.push(importParser(extracted.imports));

  return { plugins, extracted }
}

export const generateModuleCode = (data: {
  filePath: string;
  css: string;
  config: ReboostConfig;
  sourceMap: RawSourceMap;
  imports: ParsedImport[];
  module: false | { icss: ExtractedICSS; }
}) => {
  let code = '';
  let defaultExportObjStr = '{}';

  if (data.module) {
    const localNameMap = {} as Record<string, string>;
    const importedClassMap = {} as Record<string, { from: string; name: string; }>;
    const { icssImports, icssExports } = data.module.icss;

    Object.keys(icssExports).forEach((key, _, keys) => {
      const camelCased = camelCase(key);
      if (!keys.includes(camelCased)) icssExports[camelCased] = icssExports[key];
    });

    Object.keys(icssImports).forEach((key, idx) => {
      if (idx === 0) code += '// ICSS imports\n';
      const localName = localNameMap[key] = 'styles_' + idx;
      code += `import ${localName} from ${JSON.stringify(key)};\n`;

      Object.keys(icssImports[key]).forEach((className) => {
        importedClassMap[className] = {
          from: key,
          name: icssImports[key][className]
        }
      });
    });

    // { "{key}": "{value}" } -> { "{key}": `{valueWithReplacements}` }
    defaultExportObjStr = JSON.stringify(icssExports, null, 2).replace(/"(.*)":\s?"(.*)"/g, (_, key: string, value: string) => {
      const transformed = value.split(' ').map((className) => {
        const classNameData = importedClassMap[className];
        if (classNameData) {
          return `\${${localNameMap[classNameData.from]}[${JSON.stringify(classNameData.name)}]}`;
        }
        return className;
      }).join(' ');

      return `"${key}": \`${transformed}\``;
    });
  }

  code += `const defaultExport = ${defaultExportObjStr};\n`;

  let cssStr = `\n/* ${path.relative(data.config.rootDir, data.filePath).replace(/\\/g, '/')} */\n\n`;
  cssStr += data.css;
  if (data.sourceMap) {
    cssStr += '\n\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
    cssStr += Buffer.from(JSON.stringify(data.sourceMap)).toString('base64');
    cssStr += ' */';
  }

  code += `
    // Main style injection and its hot reload
    import { hot } from 'reboost/hot';

    const updateListeners = new Set();
    const css = ${JSON.stringify(cssStr)};
    let exportedCSS = css;
    defaultExport.toString = () => exportedCSS;
    
    let style;
    const removeStyle = () => {
      if (!style) return;
      style.remove();
      style = undefined;
    }

    if (!hot.data) {
      style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);

      updateListeners.add(({ __css }) => {
        if (style) style.textContent = __css;
        exportedCSS = __css;
      });

      hot.self.accept((...args) => updateListeners.forEach((cb) => cb(...args)));
    }

    export default defaultExport;
    export {
      css as __css,
      removeStyle as __removeStyle,
      updateListeners as __updateListeners
    }
  `;
  
  if (data.imports.length) {
    code += `
      // Imported style sheets
      import { ImportedStyle } from '#/css-runtime';
      let importedStyles = [];
    `;

    data.imports.forEach(({ url, media }, idx) => {
      if (url.startsWith('~')) {
        url = url.substring(1);
      } else if (!url.startsWith('/') && !url.startsWith('./')) {
        url = './' + url;
      }

      const localName = 'atImport_' + idx;
      code += `import * as ${localName} from ${JSON.stringify(url)};\n`;
      code += `importedStyles.push(ImportedStyle(${localName}, ${JSON.stringify(media)}));\n`;
    });

    code += `
      if (!hot.data) {
        importedStyles.forEach(({ apply }) => apply());
        updateListeners.add(({ __importedStyles }) => {
          importedStyles.forEach(({ destroy }) => destroy());
          if (__importedStyles) {
            __importedStyles.forEach(({ apply }) => apply());
            importedStyles = __importedStyles;
          }
        });
      }

      export const __importedStyles = importedStyles;
    `;
  }

  return code;
}

export const runtimeCode = `
  // This function removes the default style injected by the module
  // and handles the style with media
  export const ImportedStyle = (module, media) => {
    let style;
    const listener = ({ __css }) => (style.textContent = __css);

    return {
      apply() {
        if (style) return;
        module.__removeStyle();
        style = document.createElement('style');
        style.textContent = module.__css;
        if (media) style.media = media;
        document.head.appendChild(style);
        module.__updateListeners.add(listener);
      },
      destroy() {
        if (!style) return;
        style.remove();
        module.__updateListeners.delete(listener);
      }
    }
  }
`;
