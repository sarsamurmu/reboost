import Koa from 'koa';
import { IKoaProxiesOptions as ProxyOptions } from 'koa-proxies';
import chalk from 'chalk';
import portFinder from 'portfinder';
import { Matcher } from 'anymatch';
import { WatchOptions } from 'chokidar';
import { RawSourceMap } from 'source-map';
import open from 'open';
import MagicString from 'magic-string';
import { ResolveOptions } from 'enhanced-resolve';
import type * as estreeToolkitN from 'estree-toolkit';

import fs from 'fs';
import path from 'path';
import net from 'net';

import { createContentServer } from './content-server';
import { merge, ensureDir, rmDir, deepFreeze, clone, DeepFrozen, DeepRequire, mergeSourceMaps, isVersionLessThan, getExternalHost, PromiseType, serializeObject } from './utils';
import { initCache } from './cache';
import { CorePlugins } from './core-plugins';
import { esbuildPlugin, PluginName as esbuildPluginName } from './plugins/esbuild';
import { CSSPlugin, PluginName as CSSPluginName } from './plugins/css';
import { PublicResolveFn, resolve } from './core-plugins/resolver';
import { createProxyServer } from './proxy-server';

export * as builtInPlugins from './plugins';
export { PluginOptions } from './plugins';
export type { RawSourceMap }

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
  addDependency: (dependency: string) => void;
  chalk: typeof chalk;
  config: ReboostConfig;
  emitWarning: (message: string, color?: boolean) => void;
  getCompatibleSourceMap: (map: RawSourceMap) => RawSourceMap;
  getSourceMapComment: (map: any) => string;
  MagicString: typeof MagicString;
  mergeSourceMaps: typeof mergeSourceMaps;
  meta: Record<string, any>;
  resolve: PublicResolveFn;
  rootRelative: (filePath: string) => string;
}

export interface ReboostPlugin {
  name: string;
  getCacheKey: (
    utils: {
      serializeObject: typeof serializeObject,
    }
  ) => string | number;
  setup?: (
    data: {
      config: ReboostConfig;
      proxyServer: Koa;
      contentServers?: Koa[];
      resolve: PublicResolveFn;
      chalk: typeof chalk;
      instance: ReboostInstance;
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
    programPath: estreeToolkitN.NodePath<estreeToolkitN.types.Program>,
    estreeToolkit: typeof estreeToolkitN,
    filePath: string
  ) => void | Promise<void>;
}

type OrArray<T> = T | T[];

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
  /** Options for content server. Pass an array of options object for multiple content servers. */
  contentServer?: OrArray<{
    /** Name of this content server */
    name?: string;
    /** All content files will be available under this path */
    basePath?: string;
    /** Enable ETag */
    etag?: boolean;
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
  }>;
  /** Entries of files */
  entries: ([string, string] | [string, string, string])[];
  /** Enable/disable external host. Set a string of IPv4 address to set the external host */
  externalHost?: boolean | string;
  /** Enable/disable Hot reload */
  hotReload?: boolean;
  /** Use plugins included by default */
  includeDefaultPlugins?: boolean;
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

const INCOMPATIBLE_BELOW = '0.19.0';
const DEFAULT_PORT = 7456;

export const DefaultConfig: DeepFrozen<DeepRequire<ReboostConfig>> = {
  cacheDir: './.reboost_cache',
  cacheOnMemory: false,
  commonJSInterop: {
    mode: 2,
    include: /node_modules|\.cjs/,
    exclude: () => false
  },
  contentServer: undefined,
  entries: null,
  externalHost: true,
  hotReload: true,
  includeDefaultPlugins: true,
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
    preferAbsolute: undefined,
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
  name: undefined,
  basePath: '/',
  etag: true,
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
    [index: number]: {
      local: string;
      external?: string;
    }
  }
}

export type LogFn = (type: keyof Exclude<ReboostConfig['log'], boolean>, ...toLog: any[]) => void;

const createInstance = async (initialConfig: ReboostConfig) => {
  const onStopCallbacks: [() => Promise<void> | void, string][] = [];
  const it = {
    exports: {} as ReboostService,
    proxyAddress: '',
    config: {} as ReboostConfig,
    plugins: [] as ReboostPlugin[],
    contentServersOpt: [] as Exclude<ReboostConfig['contentServer'], any[]>[],
    cache: {} as ReturnType<typeof initCache>,

    /** Returns false if no entry found. If it returns false, close the app without further execution */
    Init: (): any => {
      // Config initialization
      it.config = merge(clone(DefaultConfig as ReboostConfig), initialConfig);
      
      if (!it.config.entries) {
        console.log(chalk.red('No entry found. Please add some entries first.'));
        return false;
      }
      if (!path.isAbsolute(it.config.rootDir)) it.log('info', chalk.red('rootDir should be an absolute path'));
      if (!path.isAbsolute(it.config.cacheDir)) it.config.cacheDir = path.join(it.config.rootDir, it.config.cacheDir);
      if (!it.config.watchOptions.include) it.config.watchOptions.include = /.*/;
      if (it.config.contentServer) {
        it.contentServersOpt = [].concat(it.config.contentServer)

        it.contentServersOpt.forEach((contentServer, index) => {
          it.contentServersOpt[index] = merge(
            clone(DefaultContentServerOptions as Exclude<ReboostConfig['contentServer'], any[]>),
            contentServer
          );

          if (!path.isAbsolute(contentServer.root)) {
            contentServer.root = path.join(it.config.rootDir, contentServer.root);
          }
        });
      }

      it.config.resolve.modules = [].concat(it.config.resolve.modules);
      // Add absolute path for relative modules dir path, so that resolve can work
      // for any plugins to load peerDependencies
      it.config.resolve.modules.forEach((modDirName) => {
        if (path.isAbsolute(modDirName)) return;
        (it.config.resolve.modules as string[]).push(path.join(it.config.rootDir, modDirName));
      });

      if (it.config.resolve.roots == null) {
        it.config.resolve.roots = [it.config.rootDir];
      }

      const resolveAlias = it.config.resolve.alias;
      if (resolveAlias) {
        if (Array.isArray(resolveAlias)) {
          resolveAlias.forEach((aliasData) => {
            if (Array.isArray(aliasData.alias)) {
              aliasData.alias = aliasData.alias.map((aPath) => (
                aPath.startsWith('.') ? path.join(it.config.rootDir, aPath) : aPath
              ));
            } else if (aliasData.alias && aliasData.alias.startsWith('.')) {
              aliasData.alias = path.join(it.config.rootDir, aliasData.alias);
            }
          });
        } else {
          Object.keys(resolveAlias).forEach((key) => {
            const aliasPath = resolveAlias[key];
            if (Array.isArray(aliasPath)) {
              resolveAlias[key] = aliasPath.map((aPath) => (
                aPath.startsWith('.') ? path.join(it.config.rootDir, aPath) : aPath
              ));
            } else if (aliasPath && aliasPath.startsWith('.')) {
              resolveAlias[key] = path.join(it.config.rootDir, aliasPath);
            }
          });
        }
      }

      deepFreeze(it.config);

      // Flat the plugins array
      it.plugins = ([] as ReboostPlugin[]).concat(...it.config.plugins);

      it.plugins.push(...CorePlugins(it));
      
      if (it.config.includeDefaultPlugins) {
        const pluginNames = it.plugins.map(({ name }) => name);
        
        if (!pluginNames.includes(esbuildPluginName)) {
          it.plugins.push(esbuildPlugin());
        }
        if (!pluginNames.includes(CSSPluginName)) {
          it.plugins.push(CSSPlugin());
        }
      }

      // Cache initialization
      it.cache = initCache(it.config, it.plugins, it.log);
    },

    isLogEnabled: (type: keyof Exclude<ReboostConfig['log'], boolean>) => {
      // Sorry for the extra negation *_*
      return !(!it.config.log || !it.config.log[type]);
    },
    log: ((type, ...toLog) => {
      if (it.isLogEnabled(type)) console.log(...toLog);
    }) as LogFn,
    onStop: (label: string, cb: () => Promise<any> | any) => {
      onStopCallbacks.push([cb, label]);
    },
  }

  const startServer = (
    name: string,
    server: Koa,
    port: number,
    host = 'localhost'
  ) => new Promise<void>((doneStart) => {
    const httpServer = server.listen(port, host, () => doneStart());
    const connections = new Map<string, net.Socket>();

    httpServer.on('connection', (connection) => {
      const key = `${connection.remoteAddress}:${connection.remotePort}`;
      connections.set(key, connection);
      connection.on('close', () => connections.delete(key));
    });

    it.onStop(`Closes ${name}`, () => new Promise<void>((doneClose) => {
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
  if (it.Init() === false) return false;

  // TODO: Remove it in v1.0
  const oldCacheFile = path.join(it.config.cacheDir, 'cache_data.json');
  if (fs.existsSync(oldCacheFile)) rmDir(it.config.cacheDir);

  if (it.config.dumpCache) rmDir(it.config.cacheDir);

  if (isVersionLessThan(it.cache.version, INCOMPATIBLE_BELOW)) {
    it.log('info', chalk.cyan('Cache version is incompatible, clearing cached files...'));
    rmDir(it.config.cacheDir);
    it.log('info', chalk.cyan('Clear cache complete'));
  }

  if (fs.existsSync(it.config.cacheDir)) {
    it.log('info', chalk.cyan('Refreshing cache...'));
    it.cache.verifyFiles();
    it.log('info', chalk.cyan('Refresh cache complete'));
  }

  it.log('info', chalk.green('Starting proxy server...'));

  const proxyServer = createProxyServer(it);
  const contentServers = it.config.contentServer
    ? it.contentServersOpt.map((opt) => createContentServer(it, opt))
    : undefined;
  const externalHost = await getExternalHost(it);

  for (const { setup } of it.plugins) {
    if (setup) {
      await setup({
        config: it.config,
        proxyServer,
        contentServers,
        resolve: (...args) => resolve(it, ...args),
        chalk,
        instance: it
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

    if (!fs.existsSync(path.join(it.config.rootDir, input))) {
      it.log('info', chalk.red(`The input file does not exist: ${JSON.stringify(input)}`));
      continue;
    }

    let fileContent = `import '${fullAddress}/runtime';\n`;
    fileContent += 'import';
    if (libName) fileContent += ' * as _$lib$_ from';
    fileContent += ` '${fullAddress}/transformed?q=${encodeURIComponent(path.join(it.config.rootDir, input))}';\n`;
    if (libName) fileContent += `self[${JSON.stringify(libName)}] = _$lib$_;\n`;

    fs.writeFileSync(outputPath, fileContent);
    it.log('info', chalk.cyan(`Generated: ${input} -> ${output}`));
  }

  await startServer('Proxy server', proxyServer, proxyServerPort, proxyServerHost);
  it.log('info', chalk.green('Proxy server started'));

  it.exports = {
    stop,
    proxyServer: fullAddress
  }

  if (contentServers.length) {
    for (let i = 0; i < contentServers.length; i++) {
      const address = {
        local: undefined as string,
        external: undefined as string
      }
      const contentServer = contentServers[i];
      const contentServerOpt = it.contentServersOpt[i];
      const serverName = contentServerOpt.name || i + 1;
      const contentServerPath = (host: string, port: string | number) => (
        `http://${host}:${port}${contentServerOpt.basePath}`.replace(/\/$/, '')
      );

      const localPort = await portFinder.getPortPromise({ port: contentServerOpt.port });
      address.local = contentServerPath('localhost', localPort);

      await startServer('Local content server', contentServer, localPort);

      const openOptions = contentServerOpt.open;
      if (openOptions) {
        open(address.local, typeof openOptions === 'object' ? openOptions : undefined);
      }

      if (externalHost) {
        const externalPort = await portFinder.getPortPromise({
          host: externalHost,
          port: contentServerOpt.port
        });
        address.external = contentServerPath(externalHost, externalPort);

        await startServer('External content server', contentServer, externalPort, externalHost);
      }

      if (i === 0) {
        it.exports.contentServer = Object.assign({}, address);
      }

      it.exports.contentServer[i] = address;

      it.log('info', chalk.green([
        `Content server [${serverName}] is running on:`,
        '  Local    - ' + chalk.blue(address.local),
        ...(
          address.external
            ? ['  External - ' + chalk.blue(address.external)]
            : []
        )
      ].join('\n')))
    }
  }

  return it;
}

// It shows full structure of the type in VSCode's popup if `type` is used instead of `interface`
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReboostInstance extends Exclude<PromiseType<ReturnType<typeof createInstance>>, false> {}

export const start = async (config: ReboostConfig = {} as any): Promise<ReboostService> => {
  const instance = await createInstance(config);
  return instance && instance.exports;
}

if (fs.existsSync(path.join(__dirname, '../../src'))) {
  // @ts-expect-error We don't need types for this
  import('source-map-support').then((mod) => mod.install());
}
