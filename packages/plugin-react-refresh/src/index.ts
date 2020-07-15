import * as babel from '@babel/core';

import { ReboostPlugin } from 'reboost';

interface Options {
  excludeNodeModules?: boolean;
}

export = ({ excludeNodeModules }: Options = {}): ReboostPlugin => {
  return {
    name: 'react-refresh-plugin',
    transformAST(ast, { types: t, traverse }, filePath) {
      if (excludeNodeModules && filePath.match(/node_modules/)) return;

      traverse(ast, {
        Program(path) {
          path.node.body.unshift(
            t.importDeclaration([], t.stringLiteral(require.resolve('./client-setup')))
          );

          path.stop();
        }
      });
    },
    async transformJSContent({ code }) {
      try {
        const result = await babel.transformAsync(code, {
          ast: false,
          configFile: false,
          babelrc: false,
          envName: 'development',
          comments: false,
          compact: true,
          plugins: [require.resolve('react-refresh/babel')]
        });

        return {
          code: result.code,
          map: result.map
        }
      } catch (e) {/* */}

      return null;
    }
  }
}
