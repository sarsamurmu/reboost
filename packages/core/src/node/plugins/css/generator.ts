import { AcceptedPlugin } from 'postcss';
import { localByDefault, extractImports, moduleValues, moduleScope, extractICSS, ExtractedICSS, Modes } from './modules';
import { RawSourceMap } from 'source-map';

import path from 'path';

import { ReboostConfig } from '../../index';
import { URLTester } from './index';
import { ParsedImport, importParser, ParsedURL, urlParser } from './parsers';

const camelCase = (string: string) => string.replace(/(?:^\w|[A-Z]|\b\w)/g, (match, index) => (
  index === 0 ? match.toLowerCase() : match.toUpperCase()
)).replace(/(\s|-|_)+/g, '');

let idIndex = 0;
const idMap = new Map();
const getID = (key: string) => {
  if (!idMap.has(key)) idMap.set(key, idIndex++);
  return idMap.get(key);
}

export { Modes }
export const getPlugins = (options: {
  filePath: string;
  testers: {
    import: URLTester;
    url: URLTester;
  };
  handleImports: boolean;
  handleURLS: boolean;
  module: false | {
    mode: Modes;
    exportGlobals: boolean;
    hasValues: boolean;
  }
}) => {
  const extracted = {
    imports: [] as ParsedImport[],
    urls: [] as ParsedURL[],
    icss: undefined as ExtractedICSS
  }
  const plugins: AcceptedPlugin[] = [];

  if (options.module) {
    if (options.module.hasValues) plugins.push(moduleValues());
    plugins.push(
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

  if (options.handleImports) {
    plugins.push(
      importParser(extracted.imports, (url) => options.testers.import(url, options.filePath))
    );
  }
  if (options.handleURLS) {
    plugins.push(
      urlParser(extracted.urls, (url) => options.testers.url(url, options.filePath))
    );
  }

  return { plugins, extracted }
}

const normalizeURL = (url: string) => {
  if (url.startsWith('~')) {
    url = url.substring(1);
  } else if (!url.startsWith('/') && !url.startsWith('./')) {
    url = './' + url;
  }
  return url;
}

// Checks if a import is from postcss-module-value
// CSS -> `@value <someValue> from "./file.module.css";`
const importedValueRE = /i__const_/i;
export const generateModuleCode = (data: {
  filePath: string;
  css: string;
  config: ReboostConfig;
  sourceMap: RawSourceMap;
  imports: ParsedImport[];
  urls: ParsedURL[];
  module: false | { icss: ExtractedICSS; };
}) => {
  let code = '';
  let defaultExportObjStr = '{}';
  const replacements = {} as Record<string, string>;

  if (data.module) {
    const localNameMap = {} as Record<string, string>;
    const importsMap = {} as Record<string, { from: string; name: string; }>;
    const { icssImports, icssExports } = data.module.icss;

    Object.keys(icssExports).forEach((key, _, keys) => {
      const camelCased = camelCase(key);
      if (!keys.includes(camelCased)) icssExports[camelCased] = icssExports[key];
    });

    Object.keys(icssImports).forEach((key, idx) => {
      if (idx === 0) code += '// ICSS imports\n';
      const localName = 'icss_import_' + idx;
      localNameMap[key] = localName;
      code += `import ${localName} from ${JSON.stringify(key)};\n`;

      Object.keys(icssImports[key]).forEach((importName) => {
        importsMap[importName] = {
          from: key,
          name: icssImports[key][importName]
        }

        if (importedValueRE.test(importName)) {
          replacements[importName] = `${localName}[${JSON.stringify(importsMap[importName].name)}]`;
        }
      });
    });

    const valueMap = {} as Record<string, string>;
    // Stringifies the JS object
    defaultExportObjStr = '{\n' + Object.keys(icssExports).map((key) => {
      const value = icssExports[key];
      if (typeof valueMap[value] === 'undefined') {
        valueMap[value] = '`' + value.split(' ').map((token) => {
          const importData = importsMap[token];
          if (importData) {
            return `\${${localNameMap[importData.from]}[${JSON.stringify(importData.name)}]}`;
          }
          return token;
        }).join(' ') + '`';
      }

      return `  ${JSON.stringify(key)}: ${valueMap[value]},`;
    }).join('\n') + '\n}';
  }

  code += `const defaultExport = ${defaultExportObjStr};\n`;

  const preCode = `\n/* ${path.relative(data.config.rootDir, data.filePath).replace(/\\/g, '/')} */\n\n`;
  let cssStr = preCode;
  cssStr += data.css;
  if (data.sourceMap) {
    // Fix the source map because we are prepend-ing some codes which are not mapped
    data.sourceMap.mappings = ';'.repeat(preCode.match(/\n/g).length) + data.sourceMap.mappings;

    cssStr += '\n\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,';
    cssStr += Buffer.from(JSON.stringify(data.sourceMap)).toString('base64');
    cssStr += ' */';
  }

  if (data.urls.length) {
    code += '\n\n// Used URLs\n';
    data.urls.forEach(({ url, replacement }, idx) => {
      url = normalizeURL(url);
      const localName = `url_${idx}`;
      code += `import ${localName} from ${JSON.stringify(url)};\n`;
      replacements[replacement] = localName;
    });
  }

  // Stringify replacement object with unquoted values
  // -> { "replacementName": "identifierName" } -> { "replacementName": identifierName }
  const replacementKeys = Object.keys(replacements);
  const replacementObjStr = replacementKeys.length ? ('{\n' + replacementKeys.map((key) => (
    `  ${JSON.stringify(key)}: ${replacements[key]},`
  )).join('\n') + '\n}') : '{}';

  code += `
    // Main style injection and its hot reload
    import { hot } from 'reboost/hot';
    import { replaceReplacements, patchObject } from '#/css-runtime';

    const updateListeners = new Set();
    const css = replaceReplacements(${JSON.stringify(cssStr)}, ${replacementObjStr});
    let exportedCSS = css;
    export const toString = () => exportedCSS;
    Object.defineProperty(defaultExport, 'toString', { value: toString });
    
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

      updateListeners.add(({ default: newDefaultExport, __css }) => {
        if (style) style.textContent = __css;
        exportedCSS = __css;
        patchObject(defaultExport, newDefaultExport);
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
      url = normalizeURL(url);
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
  export const replaceReplacements = (str, replacements) => {
    Object.keys(replacements).forEach((toReplace) => {
      str = str.replace(new RegExp(toReplace, 'g'), replacements[toReplace]);
    });
    return str;
  }

  export const patchObject = (object, target) => {
    Object.keys(object).forEach((key) => {
      if (!(key in target)) delete object[key];
    });
    Object.assign(object, target);
  }

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
