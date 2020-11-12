import * as babel from '@babel/core';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace ReactRefreshPlugin {
  export interface Options {
    excludeNodeModules?: boolean;
  }
}

function ReactRefreshPlugin({ excludeNodeModules = true }: ReactRefreshPlugin.Options = {}): ReboostPlugin {
  let reactRefreshPath: string;

  return {
    name: 'react-refresh-plugin',
    async transformJSContent({ code }, filePath) {
      if (excludeNodeModules && /node_modules/.test(filePath)) return;

      try {
        const preCode = /* js */`
          import * as __Runtime from ${JSON.stringify(path.join(__dirname, '../browser/runtime.js'))};
          import { hot as ReboostHot } from 'reboost/hot';

          const __prevRefreshReg = window.$RefreshReg$;
          const __prevRefreshSig = window.$RefreshSig$;

          window.$RefreshReg$ = (type, id) => {
            const fullId = ReboostHot.id + ' ' + id;
            __Runtime.register(type, fullId);
          }
          window.$RefreshSig$ = __Runtime.createSignatureFunction;\n
        `;

        const postCode = /* js */`;
          window.$RefreshReg$ = __prevRefreshReg;
          window.$RefreshSig$ = __prevRefreshSig;

          ReboostHot.self.accept((updatedModule) => {
            // Check if all exports are React components
            if (__Runtime.isReactRefreshBoundary(updatedModule)) {
              __Runtime.performReactRefresh();
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
            reactRefreshPath || (reactRefreshPath = require.resolve('react-refresh/babel'))
          ],
          sourceMaps: true
        });

        const resultCode = preCode + babelResult.code + postCode;

        if (babelResult.map) {
          babelResult.map.sources = [filePath];
          // Fix source map because we are prepend-ing some code which are not mapped
          babelResult.map.mappings = ';'.repeat(preCode.match(/\n/g).length) + babelResult.map.mappings;
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

export = ReactRefreshPlugin;
