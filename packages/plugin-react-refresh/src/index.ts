import * as babel from '@babel/core';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace ReactRefreshPlugin {
  export interface Options {
    excludeNodeModules?: boolean;
  }
}

function ReactRefreshPlugin({ excludeNodeModules = true }: ReactRefreshPlugin.Options = {}): ReboostPlugin {
  const transformOptions: babel.TransformOptions = {
    ast: false,
    configFile: false,
    babelrc: false,
    envName: 'development',
    comments: false,
    compact: true,
    plugins: [require.resolve('react-refresh/babel')],
    sourceMaps: true
  }

  const Runtime = '__React_Refresh_Runtime__';
  const Hot = '__Hot_for_React__';
  const runtimeFilePath = path.join(__dirname, '../runtime/index.js');

  const preCode = /* js */`
    import * as ${Runtime} from ${JSON.stringify(runtimeFilePath)};
    import { hot as ${Hot} } from 'reboost/hot';

    const __prevRefreshReg = self.$RefreshReg$;
    const __prevRefreshSig = self.$RefreshSig$;

    self.$RefreshReg$ = (type, id) => {
      const fullId = ${Hot}.id + ' ' + id;
      ${Runtime}.register(type, fullId);
    }
    self.$RefreshSig$ = ${Runtime}.createSignatureFunction;\n
  `;

  const postCode = /* js */`;
    self.$RefreshReg$ = __prevRefreshReg;
    self.$RefreshSig$ = __prevRefreshSig;

    ${Hot}.accept((updatedModule) => {
      // Check if all exports are React components
      if (${Runtime}.isReactRefreshBoundary(updatedModule)) {
        ${Runtime}.performReactRefresh();
      } else {
        ${Hot}.invalidate();
      }
    });
  `;

  const offsetMapping = ';'.repeat(preCode.match(/\n/g).length);

  return {
    name: 'react-refresh-plugin',
    getCacheKey: () => 1,
    async transformJSContent({ code }, filePath) {
      if (excludeNodeModules && /node_modules/.test(filePath)) return;

      try {
        const babelResult = await babel.transformAsync(code, transformOptions);

        const resultCode = preCode + babelResult.code + postCode;

        if (babelResult.map) {
          babelResult.map.sources = [filePath];
          // Fix source map because we are prepend-ing some code which are not mapped
          babelResult.map.mappings = offsetMapping + babelResult.map.mappings;
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
