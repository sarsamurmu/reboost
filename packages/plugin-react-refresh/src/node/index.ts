import * as babel from '@babel/core';

import { ReboostPlugin } from 'reboost';

interface Options {
  excludeNodeModules?: boolean;
}

export = ({
  excludeNodeModules
}: Options = {
  excludeNodeModules: true
}): ReboostPlugin => {
  return {
    name: 'react-refresh-plugin',
    async transformJSContent({ code }, filePath) {
      if (excludeNodeModules && filePath.match(/node_modules/)) return;
      
      try {
        const preCode = /* js */`
          import { isReactRefreshBoundary } from ${JSON.stringify(this.resolve(__filename, '../browser/client-setup'))};
          import RefreshRuntime from ${JSON.stringify(this.resolve(__filename, 'react-refresh/runtime'))};
          import { hot as ReboostHot } from 'reboost/hmr';

          const __prevRefreshReg = window.$RefreshReg$;
          const __prevRefreshSig = window.$RefreshSig$;

          window.$RefreshReg$ = (type, id) => {
            const fullId = ReboostHot.id + ' ' + id;
            RefreshRuntime.register(type, fullId);
          }
          window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
        `;

        const postCode = /* js */`;
          window.$RefreshReg$ = __prevRefreshReg;
          window.$RefreshSig$ = __prevRefreshSig;

          ReboostHot.self.accept((updatedModule) => {
            // Check if all exports are React components
            if (isReactRefreshBoundary(updatedModule)) {
              RefreshRuntime.performReactRefresh();
            } else {
              // TODO: Use hot.decline when it's supported
              location.reload();
            }
          });
        `;

        const babelResult = await babel.transformAsync(code, {
          ast: false,
          configFile: false,
          babelrc: false,
          envName: 'development',
          comments: false,
          compact: true,
          plugins: [this.resolve(__filename, 'react-refresh/babel')],
          sourceMaps: true
        });

        const resultCode = `${preCode}\n${babelResult.code};${postCode}`;

        if (babelResult.map) babelResult.map.sources = [filePath];
        babelResult.map.mappings = ';'.repeat(preCode.split('\n').length) + babelResult.map.mappings;

        return {
          code: resultCode,
          map: babelResult.map
        }
      } catch (e) {
        console.log(e);
      }

      return null;
    }
  }
}

/*
({ parse }) => ({
  visitor: {
    Program(program: babel.NodePath<babel.types.Program>) {
      program.node.body.unshift(
        ...(parse(preCode) as babel.types.File).program.body
      );
      program.node.body.push(
        ...(parse(postCode) as babel.types.File).program.body
      );
    }
  }
})
*/