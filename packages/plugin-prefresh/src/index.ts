import * as babel from '@babel/core';

import path from 'path';

import { ReboostPlugin } from 'reboost';

declare namespace PrefreshPlugin {
  export interface Options {
    excludeNodeModules?: boolean;
  }
}

function PrefreshPlugin({ excludeNodeModules = true }: PrefreshPlugin.Options = {}): ReboostPlugin {
  const transformOptions: babel.TransformOptions = {
    ast: false,
    configFile: false,
    babelrc: false,
    envName: 'development',
    comments: false,
    compact: true,
    plugins: [require.resolve('@prefresh/babel-plugin')],
    sourceMaps: true
  };

  const Runtime = '__Prefresh_Runtime__';
  const runtimeFilePath = path.join(__dirname, '../runtime/index.js');

  const preCode = /* js */`
    import * as ${Runtime} from ${JSON.stringify(runtimeFilePath)};

    let __prevRefreshReg;
    let __prevRefreshSig;

    if (import.meta.hot) {
      __prevRefreshReg = self.$RefreshReg$ || (() => {});
      __prevRefreshSig = self.$RefreshSig$ || (() => {});

      self.$RefreshReg$ = (type, id) => {
        self.__PREFRESH__.register(type, import.meta.hot.id + ' ' + id);
      }

      self.$RefreshSig$ = () => {
        let status = 'begin';
        let savedType;
        return (type, key, forceReset, getCustomHooks) => {
          if (!savedType) savedType = type;
          status = self.__PREFRESH__.sign(type || savedType, key, forceReset, getCustomHooks, status);
          return type;
        }
      }
    }
  `;

  const postCode = /* js */`;
    if (import.meta.hot) {
      self.$RefreshReg$ = __prevRefreshReg;
      self.$RefreshSig$ = __prevRefreshSig;

      import.meta.hot.self.accept(() => {
        try {
          ${Runtime}.flush();
        } catch (e) {
          import.meta.hot.invalidate();
        }
      });
    }
  `;

  const offsetMapping = ';'.repeat(preCode.match(/\n/g).length);

  return {
    name: 'prefresh-plugin',
    getCacheKey: () => 1,
    setup({ instance }) {
      // Internal API. Can break anytime
      instance.plugins.push({
        name: 'prefresh-core-fixer-plugin',
        getCacheKey: () => 1,
        transformJSContent({ code }, filePath) {
          if (/@prefresh[\\/]core/.test(filePath)) {
            // In `@prefresh/core/src/index.js` there is an import like
            // - import { Component } from 'preact';
            // Somehow the resolver resolves the path to
            // `<thisPackage>/node_modules/preact` and not `<userPackage>/node_modules/preact`
            // So basically the users' code and prefresh's code are using two different `Component` class
            // If we don't resolve that import manually prefresh would never work

            return {
              code: code.replace(/(import[\s\S]*?from\s*?)(['"]preact.*?['"])/g, (_, prev, quotedSource) => {
                const unquotedSource = quotedSource.match(/^(['"])(.*)(\1)$/)[2];
                const resolvedSource = this.resolve(
                  path.join(this.config.rootDir, './dummy-file'),
                  unquotedSource
                );
                return `${prev} ${JSON.stringify(resolvedSource)}`;
              }),
              map: undefined
            }
          }
        }
      });
    },
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
        console.error(e);
      }
    }
  }
}

export = PrefreshPlugin;
