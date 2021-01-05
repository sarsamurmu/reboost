// Heavily inspired by (kinda copy of) these
// - https://github.com/webpack-contrib/css-loader/blob/master/src/plugins/postcss-import-parser.js
// - https://github.com/webpack-contrib/css-loader/blob/master/src/plugins/postcss-url-parser.js

import { Declaration, Plugin, Result } from 'postcss';
import valueParser from 'postcss-value-parser';

export type TesterFn = (url: string) => boolean;
const shouldHandleURL = (url: string, testerFn: TesterFn) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
  return testerFn(url);
}

export interface ParsedImport {
  url: string;
  media: string;
}

const importRE = /@import/i;
export const hasImportsIn = (css: string) => importRE.test(css);

export const importParser = (imports: ParsedImport[], testerFn: TesterFn): Plugin => ({
  postcssPlugin: 'import-parser',
  prepare: (result) => ({
    AtRule: {
      import(node) {
        if (node.parent.type !== 'root') return;

        if (node.nodes) {
          result.warn(
            'Import statement should not contain child nodes. Please fix your import statement (check for missing semicolons)',
            { node, word: '@import' }
          );
          return;
        }

        const [firstNode, ...mediaNodes] = valueParser(node.params).nodes;
        if ((!firstNode && !mediaNodes.length) || !['string', 'function'].includes(firstNode.type)) {
          result.warn('Unable to resolve URL of the import statement', { node });
          return;
        }

        let importPath: string;

        if (firstNode.type === 'string') {
          importPath = firstNode.value;
        } else {
          if (firstNode.value.toLowerCase() !== 'url') {
            result.warn('Unable to resolve URL of the import statement', { node });
            return;
          }

          const { nodes } = (firstNode as valueParser.FunctionNode);
          const isString = nodes.length !== 0 && nodes[0].type === 'string';
          importPath = isString ? nodes[0].value : valueParser.stringify(nodes);
        }

        if (!importPath.trim().length) {
          result.warn('The import statement imports nothing', { node });
          return;
        }

        if (shouldHandleURL(importPath, testerFn)) {
          imports.push({
            url: importPath,
            media: valueParser.stringify(mediaNodes).trim().toLowerCase()
          });

          node.remove();
        }
      }
    }
  })
});

const urlRE = /url/i;
const imageSetRE = /(-webkit-)?image-set/i;
const hasURLOrImageSet = /(url|(-webkit-)?image-set)\(/i;

export interface ParsedURL {
  url: string;
  replacement: string;
}

const getFirstNodeOf = ({ nodes }: valueParser.FunctionNode) => nodes && nodes[0];

const getURL = ({ nodes }: valueParser.FunctionNode) => {
  const isString = nodes.length !== 0 && nodes[0].type === 'string';
  const url = isString ? nodes[0].value : valueParser.stringify(nodes);
  return url;
}

const isBlankURL = (url: string, result: Result, node: Declaration) => {
  if (url.trim()) return false;
  result.warn('The url is blank', { node });
  return true;
}

export const hasURLsIn = (css: string) => hasURLOrImageSet.test(css);

export const urlParser = (urls: ParsedURL[], testerFn: TesterFn): Plugin => ({
  postcssPlugin: 'url-parser',
  prepare: (result) => {
    const replacements: [declaration: Declaration, replacement: string][] = [];
    let idx = 0;
    const makeReplacement = (
      decl: Declaration,
      parsedValue: valueParser.ParsedValue,
      node: valueParser.Node,
      quoted: boolean
    ) => {
      const replacement = `__URL_REPLACEMENT_${idx++}__`;
      node.type = 'word';
      node.value = quoted ? `"${replacement}"` : replacement;
      replacements.push([decl, (parsedValue as any).toString()]);
      return replacement;
    }

    return {
      Declaration(decl) {
        if (!hasURLOrImageSet.test(decl.value)) return;

        const parsedValue = valueParser(decl.value);

        parsedValue.walk((node) => {
          if (node.type !== 'function') return;

          if (urlRE.test(node.value)) {
            const url = getURL(node);

            if (!isBlankURL(url, result, decl) && shouldHandleURL(url, testerFn)) {
              urls.push({
                url,
                replacement: makeReplacement(decl, parsedValue, getFirstNodeOf(node), false)
              });
            }

            return false;
          } else if (imageSetRE.test(node.value)) {
            node.nodes.forEach((nestedNode) => {
              if (nestedNode.type === 'function' && urlRE.test(nestedNode.value)) {
                const url = getURL(nestedNode);

                if (!isBlankURL(url, result, decl) && shouldHandleURL(url, testerFn)) {
                  urls.push({
                    url,
                    replacement: makeReplacement(decl, parsedValue, getFirstNodeOf(nestedNode), false)
                  });
                }
              } else if (nestedNode.type === 'string') {
                const url = nestedNode.value;
                if (!isBlankURL(url, result, decl) && shouldHandleURL(url, testerFn)) {
                  urls.push({
                    url,
                    replacement: makeReplacement(decl, parsedValue, nestedNode, true)
                  });
                }
              }
            });

            return false;
          }
        });
      },
      OnceExit() {
        replacements.forEach(([decl, replacement]) => decl.value = replacement);
      }
    }
  }
});
