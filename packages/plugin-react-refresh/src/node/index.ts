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
  let reactRefreshPath: string;

  return {
    name: 'react-refresh-plugin',
    async transformJSContent({ code }, filePath) {
      if (excludeNodeModules && filePath.match(/node_modules/)) return;
      
      try {
        const preCode = /* js */`
          import { isReactRefreshBoundary } from ${JSON.stringify(this.resolve(__filename, '../browser/client-setup'))};
          import RefreshRuntime from ${JSON.stringify(this.resolve(__filename, 'react-refresh/runtime'))};
          import { hot as ReboostHot } from 'reboost/hot';

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
              ReboostHot.invalidate();
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
          plugins: [
            reactRefreshPath || (reactRefreshPath = this.resolve(__filename, 'react-refresh/babel'))
          ],
          sourceMaps: true
        });

        const resultCode = `${preCode}\n${babelResult.code};${postCode}`;

        if (babelResult.map) {
          babelResult.map.sources = [filePath];
          babelResult.map.mappings = ';'.repeat(preCode.split('\n').length) + babelResult.map.mappings;
        }

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
