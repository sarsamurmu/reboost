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
import net from 'net';

import { createContentServer } from './content-server';
import { merge, ensureDir, rmDir, deepFreeze, clone, DeepFrozen, DeepRequire, mergeSourceMaps, isVersionLessThan, tLog, getExternalHost, PromiseType, setLoggerMode } from './utils';
import { createShared } from './shared';
import { verifyFiles } from './file-handler';
import { CorePlugins } from './core-plugins';
import { esbuildPlugin, PluginName as esbuildPluginName } from './plugins/esbuild';
import { CSSPlugin, PluginName as CSSPluginName } from './plugins/css';
import { PostCSSPlugin, PluginName as PostCSSPluginName } from './plugins/postcss';
import { PublicResolveFn, resolve } from './core-plugins/resolver';
import { createProxyServer } from './proxy-server';

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
  config: ReboostConfig;
  addDependency: (dependency: string) => void;
  chalk: typeof chalk;
  getCompatibleSourceMap: (map: RawSourceMap) => RawSourceMap;
  getSourceMapComment: (map: any) => string;
  MagicString: typeof MagicString;
  mergeSourceMaps: typeof mergeSourceMaps;
  resolve: PublicResolveFn;
}

export interface ReboostPlugin {
  name: string;
  getId?: () => string | number;
  setup?: (
    data: {
      config: ReboostConfig;
      proxyServer: Koa;
      contentServer?: Koa;
      resolve: PublicResolveFn;
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
  commonJSInterop?: {
    mode: 0 | 1 | 2;
    include?: Matcher;
    exclude?: Matcher;
  };
  /** Options for content server */
  contentServer?: {
    /** All content files will be available under this path */
    basePath?: string;
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
    /** Serves directory listing for directories that don't have an index file */
    serveIndex?: boolean;
  };
  /** Entries of files */
  entries: ([string, string] | [string, string, string])[];
  /** Options for logging */
  log?: false | {
    info?: boolean;
    /** The time it takes to serve a file */
    responseTime?: boolean;
    /** Files which are being added or removed from the watch list */
    watchList?: boolean;
  };
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
  /** Options for source maps */
  sourceMaps?: {
    include?: Matcher;
    exclude?: Matcher;
  };
  /** Options for file watcher */
  watchOptions?: {
    include?: Matcher;
    exclude?: Matcher;
    chokidar?: WatchOptions;
  };

  /* Developer options */
  /** If you want to run reboost in debug mode */
  debugMode?: boolean;
  /** Clears cache whenever Reboost starts. Only for use while debugging. */
  dumpCache?: boolean;
}

const INCOMPATIBLE_BELOW = '0.13.0';
const DEFAULT_PORT = 7456;

export const DefaultConfig: DeepFrozen<DeepRequire<ReboostConfig>> = {
  cacheDir: './.reboost_cache',
  cacheOnMemory: true,
  commonJSInterop: {
    mode: 2,
    include: /node_modules|\.cjs/,
    exclude: () => false
  },
  contentServer: undefined,
  entries: null,
  log: {
    info: true,
    responseTime: false,
    watchList: false,
  },
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
    fallback: undefined,
    importsFields: undefined,
    mainFiles: ['index'],
    mainFields: ['browser', 'module', 'main'],
    modules: ['node_modules'],
    plugins: undefined,
    pnpApi: undefined,
    preferRelative: undefined,
    restrictions: undefined,
    roots: undefined,
    symlinks: true
  },
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
  basePath: '/',
  extensions: ['.html'],
  hidden: false,
  index: 'index.html',
  middleware: undefined,
  open: false,
  port: undefined,
  proxy: undefined,
  root: undefined,
  serveIndex: true
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

const createInstance = async (initialConfig: ReboostConfig) => {
  const onStopCallbacks: [() => Promise<void> | void, string][] = [];
  const it = {
    exports: {} as ReboostService,
    proxyAddress: '',
    config: {} as ReboostConfig,
    plugins: [] as ReboostPlugin[],
    shared: {} as ReturnType<typeof createShared>,

    Init() {
      // Config initialization
      it.config = merge(clone(DefaultConfig as ReboostConfig), initialConfig);

      setLoggerMode(it.config.log);
      
      if (!it.config.entries) {
        console.log(chalk.red('No entry found. Please add some entries first.'));
        return true;
      }
      if (!path.isAbsolute(it.config.rootDir)) tLog('info', chalk.red('rootDir should be an absolute path'));
      if (!path.isAbsolute(it.config.cacheDir)) it.config.cacheDir = path.join(it.config.rootDir, it.config.cacheDir);
      if (!it.config.watchOptions.include) it.config.watchOptions.include = /.*/;
      if (it.config.contentServer) {
        it.config.contentServer = merge(
          clone(DefaultContentServerOptions as ReboostConfig['contentServer']),
          it.config.contentServer
        );

        if (!path.isAbsolute(it.config.contentServer.root)) {
          it.config.contentServer.root = path.join(it.config.rootDir, it.config.contentServer.root);
        }
      }

      it.config.resolve.modules = [].concat(it.config.resolve.modules);
      it.config.resolve.modules.slice().forEach((modDirName) => {
        if (path.isAbsolute(modDirName)) return;
        (it.config.resolve.modules as string[]).push(path.join(it.config.rootDir, modDirName));
      });

      deepFreeze(it.config);

      // Plugins initialization
      const flatPlugins: ReboostPlugin[] = [];
      it.config.plugins.forEach((plugin) => {
        flatPlugins.push(...(Array.isArray(plugin) ? plugin : [plugin]));
      });
      it.plugins = flatPlugins;

      it.plugins.push(...CorePlugins(it));
      const pluginNames = it.plugins.map(({ name }) => name);

      if (!pluginNames.includes(esbuildPluginName)) {
        it.plugins.push(esbuildPlugin());
      }
      if (!pluginNames.includes(CSSPluginName)) {
        it.plugins.unshift(CSSPlugin());
      }
      if (!pluginNames.includes(PostCSSPluginName)) {
        it.plugins.unshift(PostCSSPlugin());
      }

      // Shared initialization
      it.shared = createShared(it.config, it.plugins);
    },

    onStop(label: string, cb: () => Promise<any> | any) {
      onStopCallbacks.push([cb, label]);
    },
  }

  const startServer = (name: string, server: Koa, port: number, host = 'localhost') => new Promise((doneStart) => {
    const httpServer = server.listen(port, host, () => doneStart());
    const connections = new Map<string, net.Socket>();

    httpServer.on('connection', (connection) => {
      const key = `${connection.remoteAddress}:${connection.remotePort}`;
      connections.set(key, connection);
      connection.on('close', () => connections.delete(key));
    });

    it.onStop(`Closes ${name}`, () => new Promise((doneClose) => {
      connections.forEach((connection) => connection.destroy());
      httpServer.close(() => doneClose());
    }));
  });

  const stop = async () => {
    for (const [onStop] of onStopCallbacks) {
      await onStop();
    }
    for (const { stop: stopPlugin } of it.plugins) {
      if (stopPlugin) await stopPlugin();
    }
  }

  // Initialize all properties
  const shouldClose = it.Init();
  if (shouldClose) return;

  if (it.config.dumpCache) rmDir(it.config.cacheDir);

  // TODO: Remove in v1.0
  const oldCacheFilesDir = path.join(it.config.cacheDir, 'files_data.json');
  if (fs.existsSync(oldCacheFilesDir)) rmDir(oldCacheFilesDir);

  let shouldClearCache = true;
  let clearCacheReason = '';
  if (isVersionLessThan(it.shared.getFilesData().version, INCOMPATIBLE_BELOW)) {
    clearCacheReason = 'Cache version is incompatible';
  } else if (it.shared.hasPluginsChanged()) {
    clearCacheReason = 'Plugin change detected';
  } else if (it.shared.getFilesData().mode !== it.config.mode) {
    clearCacheReason = 'Mode change detected';
  } else {
    shouldClearCache = false;
  }

  if (shouldClearCache) {
    tLog('info', chalk.cyan(`${clearCacheReason}, clearing cached files...`));
    rmDir(it.config.cacheDir);
    tLog('info', chalk.cyan('Clear cache complete'));
  }

  if (fs.existsSync(it.config.cacheDir)) {
    tLog('info', chalk.cyan('Refreshing cache...'));
    verifyFiles(it);
    tLog('info', chalk.cyan('Refresh cache complete'));
  }

  tLog('info', chalk.green('Starting proxy server...'));

  const proxyServer = createProxyServer(it);
  const contentServer = it.config.contentServer ? createContentServer(it) : undefined;
  const externalHost = getExternalHost();

  for (const { setup } of it.plugins) {
    if (setup) {
      await setup({
        config: it.config,
        proxyServer,
        contentServer,
        resolve: (...args) => resolve(it, ...args),
        chalk
      });
    }
  }

  const proxyServerHost = externalHost || 'localhost';
  const proxyServerPort = await portFinder.getPortPromise({
    host: proxyServerHost,
    port: DEFAULT_PORT
  });

  const fullAddress = it.proxyAddress = `http://${proxyServerHost}:${proxyServerPort}`;

  for (const [input, output, libName] of it.config.entries) {
    const outputPath = path.join(it.config.rootDir, output);
    ensureDir(path.dirname(outputPath));

    let fileContent = `import '${fullAddress}/setup';\n`;
    fileContent += 'import';
    if (libName) fileContent += ' * as _$lib$_ from';
    fileContent += ` '${fullAddress}/transformed?q=${encodeURIComponent(path.join(it.config.rootDir, input))}';\n`;
    if (libName) fileContent += `self[${JSON.stringify(libName)}] = _$lib$_;\n`;

    fs.writeFileSync(outputPath, fileContent);
    tLog('info', chalk.cyan(`Generated: ${input} -> ${output}`));
  }

  await startServer('Proxy server', proxyServer, proxyServerPort, proxyServerHost);
  tLog('info', chalk.green('Proxy server started'));

  if (contentServer) {
    const contentServerPath = (host: string, port: string | number) => {
      return `http://${host}:${port}${it.config.contentServer.basePath}`.replace(/\/$/, '');
    }
    const startedAt = (address: string) => {
      tLog('info', chalk.green(`Content server started at: ${address}`));
    }

    const localPort = await portFinder.getPortPromise({
      port: it.config.contentServer.port
    });
    const contentServerLocal = contentServerPath('localhost', localPort);

    await startServer('Local content server', contentServer, localPort);
    startedAt(contentServerLocal);

    const openOptions = it.config.contentServer.open;
    if (openOptions) {
      open(contentServerLocal, typeof openOptions === 'object' ? openOptions : undefined);
    }

    if (externalHost) {
      const externalPort = await portFinder.getPortPromise({
        host: externalHost,
        port: it.config.contentServer.port
      });
      const contentServerExternal = contentServerPath(externalHost, externalPort);

      await startServer('External content server', contentServer, externalPort, externalHost);
      startedAt(contentServerExternal);

      it.exports = {
        stop,
        proxyServer: fullAddress,
        contentServer: {
          local: contentServerLocal,
          external: contentServerExternal
        }
      }
    } else {
      it.exports = {
        stop,
        proxyServer: fullAddress,
        contentServer: {
          local: contentServerLocal
        }
      }
    }
  } else {
    it.exports = {
      stop,
      proxyServer: fullAddress
    }
  }

  return it;
}

// It shows full structure in VSCode's popup if `type` is used instead of `interface`
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReboostInstance extends PromiseType<ReturnType<typeof createInstance>> { }

export const start = async (config: ReboostConfig = {} as any): Promise<ReboostService> => {
  const instance = await createInstance(config);
  return instance && instance.exports;
}
