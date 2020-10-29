// Heavily inspired by
// - https://github.com/webpack-contrib/css-loader/blob/master/src/plugins/postcss-import-parser.js

import { Plugin } from 'postcss';
import valueParser from 'postcss-value-parser';

const shouldHandleURL = (url: string) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;

  return true;
}

export type ParsedImport = {
  url: string;
  media: string;
};

export const importParser = (imports: ParsedImport[]): Plugin => {
  return {
    postcssPlugin: 'import-parser',
    prepare: (result) => ({
      AtRule: {
        import(node) {
          if (node.parent.type !== 'root') return;

          if (node.nodes) {
            return result.warn(
              'Import statement should not contain child nodes. Please fix your import statement (check for missing semicolons)',
              { node, word: '@import' }
            );
          }

          const [firstNode, ...mediaNodes] = valueParser(node.params).nodes;
          if ((!firstNode && !mediaNodes.length) || !['string', 'function'].includes(firstNode.type)) {
            return result.warn('Unable to resolve URL of the import statement', { node });
          }

          let importPath: string;

          if (firstNode.type === 'string') {
            importPath = firstNode.value;
          } else {
            if (firstNode.value.toLowerCase() !== 'url') {
              return result.warn('Unable to resolve URL of the import statement', { node });
            }

            const { nodes } = (firstNode as valueParser.FunctionNode);
            const isString = nodes.length !== 0 && nodes[0].type === 'string';
            importPath = isString ? nodes[0].value : valueParser.stringify(nodes);
          }

          if (!importPath.trim().length) {
            return result.warn('The import statement imports nothing', { node });
          }

          if (shouldHandleURL(importPath)) {
            imports.push({
              url: importPath,
              media: valueParser.stringify(mediaNodes).trim().toLowerCase()
            });

            node.remove();
          }
        }
      },
      // OnceExit() {/* Do final things here */}
    })
  }
}
