import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import serveStatic from 'koa-static';
import withWebSocket from 'koa-websocket';
import chalk from 'chalk';
import portFinder from 'portfinder';
import { Matcher } from 'anymatch';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import { WatchOptions } from 'chokidar';
import { RawSourceMap } from 'source-map';
import open from 'open';
import proxy, { IKoaProxiesOptions as ProxyOptions } from 'koa-proxies';
import MagicString from 'magic-string';

import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import http from 'http';

import { createRouter } from './router';
import { merge, ensureDir, rmDir, deepFreeze, clone, DeepFrozen, DeepRequire, mergeSourceMaps } from './utils';
import { setAddress, setConfig, setWebSocket, getFilesData } from './shared';
import { verifyFiles } from './file-handler';
import { CorePlugins } from './core-plugins';
import { esbuildPlugin, PluginName as esbuildPluginName } from './plugins/esbuild';
import { CSSPlugin, PluginName as CSSPluginName } from './plugins/css';
import { PostCSSPlugin, PluginName as PostCSSPluginName } from './plugins/postcss';
import { resolve } from './core-plugins/resolver';

export * as builtInPlugins from './plugins';
export * from './plugins/removed';

export { RawSourceMap }

export interface LoadedData {
  code: string;
  type: string;
  map?: RawSourceMap;
}

export interface TransformedContent {
  code: string;
  map: RawSourceMap;
  type?: string;
}

export interface JSContent {
  code: string;
  inputMap?: RawSourceMap;
}

export interface PluginContext {
  address: string;
  config: ReboostConfig;
  addDependency: (dependency: string) => void;
  chalk: typeof chalk;
  getCompatibleSourceMap: (map: RawSourceMap) => RawSourceMap;
  getSourceMapComment: (map: any) => string;
  MagicString: typeof MagicString;
  mergeSourceMaps: typeof mergeSourceMaps;
  resolve: typeof resolve;
}

export interface ReboostPlugin {
  name: string;
  setup?: (
    data: {
      config: ReboostConfig;
      app: Koa;
      router: Router;
      resolve: typeof resolve;
      chalk: typeof chalk;
    }
  ) => void | Promise<void>;
  resolve?: (pathToResolve: string, relativeTo: string) => string | Promise<string>;
  load?: (this: PluginContext, filePath: string) => LoadedData | Promise<LoadedData>;
  transformContent?: (
    this: PluginContext,
    data: {
      code: string;
      type: string;
      map: RawSourceMap;
    },
    filePath: string
  ) => TransformedContent | Error | Promise<TransformedContent | Error>;
  transformIntoJS?: (
    this: PluginContext,
    data: {
      code: string;
      type: string;
      map: RawSourceMap;
    },
    filePath: string
  ) => JSContent | Error | Promise<JSContent | Error>;
  transformAST?: (
    this: PluginContext,
    ast: babelTypes.Node,
    babel: {
      traverse: typeof babelTraverse;
      types: typeof babelTypes;
    },
    filePath: string
  ) => void | Promise<void>;
}

export interface ReboostConfig {
  /**
   * Directory to use for storing cached files
   * @default ./.reboost_cache
   */
  cacheDir?: string;
  /** Cache on transformed files on memory */
  cacheOnMemory?: boolean;
  /** Options for content server */
  contentServer?: {
    /** Directory which the content server should serve */
    root: string;
    /** Options for automatically opening content server URL when ready */
    open?: open.Options;
    proxy?: Record<string, string | ProxyOptions>;
    onReady?: (app: Koa) => void;
  } & serveStatic.Options;
  /** Entries of files */
  entries: ([string, string] | [string, string, string])[];
  /** Plugins you want to use with Reboost */
  plugins?: ReboostPlugin[];
  /**
   * Directory to use as root
   * @default .
   */
  rootDir?: string;
  /** Resolve options to use when resolving files */
  resolve?: {
    /** Aliases to use while resolving */
    alias?: Record<string, string>;
    /**
     * Extensions to use while resolving
     * @default ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.json']
     */
    extensions?: string[];
    /**
     * Fields to check in package.json for script file
     * @default ['module', 'main']
     */
    mainFields?: string[];
    /**
     * File names to use while resolving directory
     * @default ['index']
     */
    mainFiles?: string[];
    /**
     * Module directories to use while resolving modules
     * @default ['./node_modules']
     */
    modules?: string[];
  };
  /** When enabled, logs the time it takes to serve a file */
  showResponseTime?: boolean;
  /** Options for sourceMaps */
  sourceMaps?: {
    include?: Matcher;
    exclude?: Matcher;
  };
  watchOptions?: {
    include?: Matcher;
    exclude?: Matcher;
    chokidar?: WatchOptions;
  };

  // Developer options
  /** If you want to run reboost in debug mode */
  debugMode?: boolean;
  /** Clears cache whenever reboost starts. Only for use while debugging. */
  dumpCache?: boolean;
}

const INCOMPATIBLE_BELOW = 31;

export const DefaultConfig: DeepFrozen<DeepRequire<ReboostConfig>> = {
  cacheDir: './.reboost_cache',
  cacheOnMemory: true,
  contentServer: undefined,
  entries: null,
  plugins: [],
  rootDir: process.cwd(),
  resolve: {
    alias: {},
    extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.es6', '.es', '.json'],
    mainFiles: ['index'],
    mainFields: ['module', 'main'],
    modules: ['node_modules']
  },
  showResponseTime: false,
  sourceMaps: {
    include: /.*/,
    exclude: /node_modules/
  },
  watchOptions: {
    include: undefined,
    exclude: /node_modules/,
    chokidar: undefined
  },

  dumpCache: false,
  debugMode: false
};

deepFreeze(DefaultConfig);

export const start = (config: ReboostConfig = {} as any) => {
  return new Promise((resolvePromise) => {
    (async () => {
      config = setConfig(merge(clone(DefaultConfig as ReboostConfig), config));

      if (!config.entries) {
        console.log(chalk.red('[reboost] No entry found. Please add some entries first.'));
        process.exit(1);
      }

      if (!path.isAbsolute(config.rootDir)) console.log(chalk.red('rootDir should be an absolute path'));
      if (!path.isAbsolute(config.cacheDir)) config.cacheDir = path.join(config.rootDir, config.cacheDir);
      if (!config.watchOptions.include) {
        config.watchOptions.include = /.*/;
      }
      if (config.contentServer && !path.isAbsolute(config.contentServer.root)) {
        config.contentServer.root = path.join(config.rootDir, config.contentServer.root);
      }

      config.plugins.push(...CorePlugins);
      const pluginNames = config.plugins.map(({ name }) => name);

      if (!pluginNames.includes(esbuildPluginName)) {
        config.plugins.push(esbuildPlugin());
      }
      if (!pluginNames.includes(CSSPluginName)) {
        config.plugins.unshift(CSSPlugin());
      }
      if (!pluginNames.includes(PostCSSPluginName)) {
        config.plugins.unshift(PostCSSPlugin());
      }

      if (config.dumpCache) rmDir(config.cacheDir);

      if (getFilesData().version < INCOMPATIBLE_BELOW) {
        console.log(chalk.cyan('[reboost] Cache version is incompatible, clearing cached files...'));
        rmDir(config.cacheDir);
        console.log(chalk.cyan('[reboost] Clear cache complete'));
      }

      if (fs.existsSync(config.cacheDir)) {
        console.log(chalk.cyan('[reboost] Refreshing cache...'));
        verifyFiles();
        console.log(chalk.cyan('[reboost] Refresh cache complete'));
      }

      console.log(chalk.green('[reboost] Starting proxy server...'));

      const app = withWebSocket(new Koa());
      const router = createRouter();
      const interfaces = networkInterfaces();
      let host: string;
      let port: number;

      loop: for (const dev in interfaces) {
        for (const details of interfaces[dev]) {
          if (details.family === 'IPv4' && !details.internal) {
            host = details.address;
            port = await portFinder.getPortPromise({ host });
            break loop;
          }
        }
      }

      if (!host && !port) {
        host = 'localhost';
        port = await portFinder.getPortPromise();
      }

      const fullAddress = `http://${host}:${port}`;
      setAddress(fullAddress);

      for (const [input, output, libName] of config.entries) {
        const outputPath = path.join(config.rootDir, output);
        ensureDir(path.dirname(outputPath));

        let fileContent = `import '${fullAddress}/setup';\n`;
        fileContent += 'import';
        if (libName) fileContent += ' * as _$lib$_ from';
        fileContent += ` '${fullAddress}/transformed?q=${encodeURI(path.join(config.rootDir, input))}';\n`;
        if (libName) fileContent += `window['${libName}'] = _$lib$_;\n`;

        fs.promises.writeFile(outputPath, fileContent);
        console.log(chalk.cyan(`[reboost] Generated: ${input} -> ${output}`));
      }

      app.ws.use((ctx) => {
        setWebSocket(ctx.websocket);
      });

      const setupPromises: Promise<void>[] = [];
      config.plugins.forEach(({ setup }) => {
        if (setup) {
          const promise = setup({ config, app, router, resolve, chalk });
          if (promise) setupPromises.push(promise);
        }
      });
      await Promise.all(setupPromises);
      deepFreeze(config);

      app
        .use(cors({ origin: '*' }))
        .use(router.routes())
        .use(router.allowedMethods())
        .listen(port, host, async () => {
          console.log(chalk.green('[reboost] Proxy server started'));

          if (config.contentServer) {
            const contentServer = new Koa();

            contentServer.use(serveStatic(config.contentServer.root, config.contentServer));

            const proxyObject = config.contentServer.proxy;
            if (proxyObject) {
              for (const key in proxyObject) {
                const proxyOptions: ProxyOptions = typeof proxyObject[key] === 'string'
                  ? { target: proxyObject[key] as string }
                  : proxyObject[key] as ProxyOptions;

                contentServer.use(proxy(key, proxyOptions));
              }
            }

            if (config.contentServer.onReady) config.contentServer.onReady(contentServer);

            const startedAt = (address: string) => {
              console.log(chalk.green(`[reboost] Content server started at: http://${address}`));
            }

            const localPort = await portFinder.getPortPromise();
            http.createServer(contentServer.callback()).listen(
              localPort,
              () => startedAt(`localhost:${localPort}`)
            );

            const openOptions = config.contentServer.open;
            if (openOptions) {
              open(`http://localhost:${localPort}`, typeof openOptions === 'object' ? openOptions : undefined);
            }

            if (host !== 'localhost') {
              const ipPort = await portFinder.getPortPromise({ host });
              http.createServer(contentServer.callback()).listen(
                ipPort,
                host,
                () => startedAt(`${host}:${ipPort}`)
              );

              return resolvePromise({
                proxyServer: fullAddress,
                contentServer: {
                  local: `http://localhost:${localPort}`,
                  ip: `http://${host}:${ipPort}`
                }
              });
            }

            return resolvePromise({
              proxyServer: fullAddress,
              contentServer: {
                local: `http://localhost:${localPort}`
              }
            });
          }

          resolvePromise({
            proxyServer: fullAddress
          });
        });
    })();
  });
}
