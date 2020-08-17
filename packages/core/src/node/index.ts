import Koa from 'koa';
import { IKoaProxiesOptions as ProxyOptions } from 'koa-proxies';
import chalk from 'chalk';
import portFinder from 'portfinder';
import { Matcher } from 'anymatch';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import { WatchOptions } from 'chokidar';
import { RawSourceMap } from 'source-map';
import open from 'open';
import MagicString from 'magic-string';
import { ResolveOptions } from 'enhanced-resolve';

import fs from 'fs';
import path from 'path';
import { networkInterfaces } from 'os';
import net from 'net';

import { initContentServer } from './content-server';
import { merge, ensureDir, rmDir, deepFreeze, clone, DeepFrozen, DeepRequire, mergeSourceMaps, isVersionLessThan } from './utils';
import { setAddress, setConfig, getFilesData, getUsedPlugins, getServiceStoppers, getPlugins, addServiceStopper } from './shared';
import { verifyFiles } from './file-handler';
import { CorePlugins } from './core-plugins';
import { esbuildPlugin, PluginName as esbuildPluginName } from './plugins/esbuild';
import { CSSPlugin, PluginName as CSSPluginName } from './plugins/css';
import { PostCSSPlugin, PluginName as PostCSSPluginName } from './plugins/postcss';
import { resolve } from './core-plugins/resolver';
import { initProxyServer } from './proxy-server';

export * as builtInPlugins from './plugins';
export { PluginOptions } from './plugins';
export * from './plugins/removed';

export type { babelTypes, RawSourceMap }

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
  getId?: () => string | number;
  setup?: (
    data: {
      config: ReboostConfig;
      proxyServer: Koa;
      contentServer?: Koa;
      resolve: typeof resolve;
      chalk: typeof chalk;
    }
  ) => void | Promise<void>;
  stop?: () => void | Promise<void>;
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
  transformJSContent?: ReboostPlugin['transformContent'];
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
  /** Directory to use for storing cached files */
  cacheDir?: string;
  /** Cache transformed files on memory */
  cacheOnMemory?: boolean;
  /** Mode for CommonJS interoperability */
  commonJSInteropMode?: 0 | 1 | 2;
  /** Options for content server */
  contentServer?: {
    /** Extensions to resolve when no extension is present in the URL */
    extensions?: false | string[];
    /** When enabled, also serves hidden files */
    hidden?: boolean;
    /** Name of the index file to serve automatically when serving a directory */
    index?: string | false;
    /** Middleware(s) to use */
    middleware?: Koa.Middleware | Koa.Middleware[];
    /** Options for automatically opening content server URL when ready */
    open?: boolean | open.Options;
    /** Port to use for content server */
    port?: number;
    /** Proxies to redirect requests */
    proxy?: Record<string, string | ProxyOptions>;
    /** Directory which the content server should serve */
    root: string;
  };
  /** Entries of files */
  entries: ([string, string] | [string, string, string])[];
  /** Mode to set as `process.env.NODE_ENV` */
  mode?: string;
  /** Plugins you want to use with Reboost */
  plugins?: (ReboostPlugin | ReboostPlugin[])[];
  /** Directory to use as root */
  rootDir?: string;
  /** Resolve options to use when resolving files */
  resolve?: Omit<
    ResolveOptions, 
    'cachePredicate' | 'cacheWithContext' | 'fileSystem' | 'unsafeCache' |
    'resolver' | 'fullySpecified' | 'resolveToContext' | 'useSyncFileSystemCalls'
  >;
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

  /* Developer options */
  /** If you want to run reboost in debug mode */
  debugMode?: boolean;
  /** Clears cache whenever reboost starts. Only for use while debugging. */
  dumpCache?: boolean;
}

const INCOMPATIBLE_BELOW = '0.11.0';
const DEFAULT_PORT = 7456;

export const DefaultConfig: DeepFrozen<DeepRequire<ReboostConfig>> = {
  cacheDir: './.reboost_cache',
  cacheOnMemory: true,
  commonJSInteropMode: 1,
  contentServer: undefined,
  entries: null,
  mode: 'development',
  plugins: [],
  rootDir: process.cwd(),
  resolve: {
    alias: undefined,
    aliasFields: ['browser'],
    conditionNames: ['import', 'require', 'node', 'default'],
    descriptionFiles: ['package.json'],
    enforceExtension: false,
    exportsFields: ['exports'],
    extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.es6', '.es', '.json'],
    mainFiles: ['index'],
    mainFields: ['browser', 'module', 'main'],
    modules: ['node_modules'],
    plugins: undefined,
    pnpApi: undefined,
    restrictions: undefined,
    roots: undefined,
    symlinks: true
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

export const DefaultContentServerOptions: DeepFrozen<DeepRequire<ReboostConfig['contentServer']>> = {
  extensions: ['.html'],
  hidden: false,
  index: 'index.html',
  middleware: undefined,
  open: false,
  port: undefined,
  proxy: undefined,
  root: undefined
}

deepFreeze(DefaultConfig);
deepFreeze(DefaultContentServerOptions);

export interface ReboostService {
  /** The function to stop Reboost */
  stop: () => Promise<void>;
  /** URL where the proxy server is listening */
  proxyServer: string;
  /** URLs where the content server is listening */
  contentServer?: {
    local: string;
    external?: string;
  }
}

export const start = async (config: ReboostConfig = {} as any): Promise<ReboostService> => {
  const stop = async () => {
    for (const [stopService] of getServiceStoppers()) {
      await stopService();
    }
    for (const { stop: stopPlugin } of getPlugins()) {
      if (stopPlugin) await stopPlugin();
    }
  }

  config = setConfig(merge(clone(DefaultConfig as ReboostConfig), config));

  if (!config.entries) {
    console.log(chalk.red('[reboost] No entry found. Please add some entries first.'));
    return;
  }

  if (!path.isAbsolute(config.rootDir)) console.log(chalk.red('rootDir should be an absolute path'));
  if (!path.isAbsolute(config.cacheDir)) config.cacheDir = path.join(config.rootDir, config.cacheDir);
  if (!config.watchOptions.include) config.watchOptions.include = /.*/;
  if (config.contentServer) {
    config.contentServer = merge(
      clone(DefaultContentServerOptions as ReboostConfig['contentServer']),
      config.contentServer
    );

    if (!path.isAbsolute(config.contentServer.root)) {
      config.contentServer.root = path.join(config.rootDir, config.contentServer.root);
    }
  }

  config.resolve.modules = [].concat(config.resolve.modules);
  config.resolve.modules.slice().forEach((modDirName) => {
    if (path.isAbsolute(modDirName)) return;
    (config.resolve.modules as string[]).push(path.join(config.rootDir, modDirName));
  });

  let plugins: ReboostPlugin[] = [];
  config.plugins.forEach((plugin) => {
    plugins.push(...(Array.isArray(plugin) ? plugin : [plugin]));
  });
  config.plugins = plugins = plugins.filter((p) => !!p);

  plugins.push(...CorePlugins());
  const pluginNames = plugins.map(({ name }) => name);

  if (!pluginNames.includes(esbuildPluginName)) {
    plugins.push(esbuildPlugin());
  }
  if (!pluginNames.includes(CSSPluginName)) {
    plugins.unshift(CSSPlugin());
  }
  if (!pluginNames.includes(PostCSSPluginName)) {
    plugins.unshift(PostCSSPlugin());
  }

  if (config.dumpCache) rmDir(config.cacheDir);

  // TODO: Remove in v1.0
  const oldCacheFilesDir = path.join(config.cacheDir, 'files_data.json');
  if (fs.existsSync(oldCacheFilesDir)) rmDir(oldCacheFilesDir);

  const isCacheIncompatible = isVersionLessThan(getFilesData().version, INCOMPATIBLE_BELOW);
  const isPluginsChanged = getFilesData().usedPlugins !== getUsedPlugins();
  if (isCacheIncompatible || isPluginsChanged) {
    console.log(chalk.cyan(
      isCacheIncompatible
        ? '[reboost] Cache version is incompatible, clearing cached files...'
        : '[reboost] Plugin change detected, clearing cached files...'
    ));
    rmDir(config.cacheDir);
    console.log(chalk.cyan('[reboost] Clear cache complete'));
  }

  if (fs.existsSync(config.cacheDir)) {
    console.log(chalk.cyan('[reboost] Refreshing cache...'));
    verifyFiles();
    console.log(chalk.cyan('[reboost] Refresh cache complete'));
  }

  console.log(chalk.green('[reboost] Starting proxy server...'));

  const proxyServer = initProxyServer();
  const contentServer = config.contentServer ? initContentServer() : undefined;
  const interfaces = networkInterfaces();
  let host: string;
  let port: number;

  loop: for (const dev in interfaces) {
    for (const details of interfaces[dev]) {
      if (details.family === 'IPv4' && !details.internal) {
        host = details.address;
        port = await portFinder.getPortPromise({
          host,
          port: DEFAULT_PORT
        });
        break loop;
      }
    }
  }

  if (!host && !port) {
    host = 'localhost';
    port = await portFinder.getPortPromise({ port: DEFAULT_PORT });
  }

  const fullAddress = setAddress(`http://${host}:${port}`);

  for (const [input, output, libName] of config.entries) {
    const outputPath = path.join(config.rootDir, output);
    ensureDir(path.dirname(outputPath));

    let fileContent = `import '${fullAddress}/setup';\n`;
    fileContent += 'import';
    if (libName) fileContent += ' * as _$lib$_ from';
    fileContent += ` '${fullAddress}/transformed?q=${encodeURI(path.join(config.rootDir, input))}';\n`;
    if (libName) fileContent += `self[${JSON.stringify(libName)}] = _$lib$_;\n`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(chalk.cyan(`[reboost] Generated: ${input} -> ${output}`));
  }

  deepFreeze(config);

  for (const { setup } of plugins) {
    if (setup) {
      await setup({
        config,
        proxyServer,
        contentServer,
        resolve,
        chalk
      });
    }
  }

  const startServer = (name: string, server: Koa, aPort: number, aHost = 'localhost') => new Promise((doneStart) => {
    const httpServer = server.listen(aPort, aHost, () => doneStart());
    const connections = new Map<string, net.Socket>();

    httpServer.on('connection', (connection) => {
      const key = `${connection.remoteAddress}:${connection.remotePort}`;
      connections.set(key, connection);
      connection.on('close', () => connections.delete(key));
    });

    addServiceStopper(name, () => new Promise((doneClose) => {
      connections.forEach((connection) => connection.destroy());
      httpServer.close(() => doneClose());
    }));
  });

  await startServer('Proxy server', proxyServer, port, host);

  console.log(chalk.green('[reboost] Proxy server started'));

  if (contentServer) {
    const startedAt = (address: string) => {
      console.log(chalk.green(`[reboost] Content server started at: http://${address}`));
    }

    const localPort = await portFinder.getPortPromise({
      port: config.contentServer.port
    });

    await startServer('Local content server', contentServer, localPort);

    startedAt(`localhost:${localPort}`);

    const openOptions = config.contentServer.open;
    if (openOptions) {
      open(`http://localhost:${localPort}`, typeof openOptions === 'object' ? openOptions : undefined);
    }

    if (host !== 'localhost') {
      const externalPort = await portFinder.getPortPromise({
        host,
        port: config.contentServer.port
      });
      
      await startServer('External content server', contentServer, externalPort, host);

      startedAt(`${host}:${externalPort}`);

      return {
        stop,
        proxyServer: fullAddress,
        contentServer: {
          local: `http://localhost:${localPort}`,
          external: `http://${host}:${externalPort}`
        }
      }
    }

    return {
      stop,
      proxyServer: fullAddress,
      contentServer: {
        local: `http://localhost:${localPort}`
      }
    }
  }

  return {
    stop,
    proxyServer: fullAddress
  }
}
