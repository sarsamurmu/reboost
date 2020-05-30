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

import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import http from 'http';

import { createRouter } from './router';
import { merge, ensureDir, rmDir, mergeSourceMaps, deepFreeze } from './utils';
import { setAddress, setConfig, setWebSocket, getFilesData } from './shared';
import { verifyFiles } from './file-handler';
import { defaultPlugins } from './plugins/defaults';
import { esbuildPlugin, PluginName as esbuildPluginName } from './plugins/esbuild';
import { CSSPlugin, PluginName as CSSPluginName } from './plugins/css';

export * from './plugins';

export interface LoadedData {
  code: string;
  type: string;
  original?: string;
  map?: string;
}

export interface TransformedContent {
  code: string;
  map: string;
  type?: string;
}

export interface JSContent {
  code: string;
  inputMap?: string;
}

export interface PluginContext {
  address: string;
  config: ReboostConfig;
  getCompatibleSourceMap: (map: RawSourceMap) => RawSourceMap;
  mergeSourceMaps: typeof mergeSourceMaps;
}

export interface ReboostPlugin {
  name: string;
  setup?: (
    data: {
      config: ReboostConfig;
      app: Koa;
      router: Router
    }
  ) => void | Promise<void>;
  resolve?: (pathToResolve: string, relativeTo: string) => string | Promise<string>;
  load?: (this: PluginContext, filePath: string) => LoadedData | Promise<LoadedData>;
  transformContent?: (
    this: PluginContext,
    data: {
      code: string;
      type: string;
    },
    filePath: string
  ) => TransformedContent | Promise<TransformedContent>;
  transformIntoJS?: (
    this: PluginContext,
    data: {
      code: string;
      type: string;
      map: string;
      original: string;
    },
    filePath: string
  ) => JSContent | Promise<JSContent>;
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
  /** File entries */
  entries: ([string, string] | [string, string, string])[];
  /** Directory to use as root */
  rootDir?: string;
  /** Resolve options to use when resolving files */
  resolve?: {
    /** Aliases to use while resolving */
    alias?: Record<string, string>;
    /** Extensions to use while resolving */
    extensions?: string[];
    /** File names to use while resolving directory */
    mainFiles?: string[];
    /** Module directories to use while resolving modules */
    modules?: string[];
  };
  watchOptions?: {
    include?: Matcher;
    exclude?: Matcher;
    chokidar?: WatchOptions;
  };
  /** Options for sourceMaps */
  sourceMaps?: {
    include?: Matcher;
    exclude?: Matcher;
  };
  /** Plugins you want to use */
  plugins?: ReboostPlugin[];
  /** Options for content server */
  contentServer?: {
    root: string;
    onReady?: (koa: Koa) => void;
  } & Omit<serveStatic.Options, 'defer'>;

  /** If you want to run reboost in debug mode */
  debugMode?: boolean;
  /** Clears cache whenever reboost starts. Only use while debugging */
  dumpCache?: boolean;
}

const INCOMPATIBLE_BELOW = 7;

export const start = async (config: ReboostConfig = {} as any) => {
  config = setConfig(merge<ReboostConfig>({
    cacheDir: './.reboost_cache',
    entries: null,
    rootDir: '.',
    resolve: {
      alias: {},
      extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.json'],
      mainFiles: ['index'],
      modules: ['node_modules']
    },
    watchOptions: {
      exclude: /node_modules/,
      chokidar: {}
    },
    sourceMaps: {
      include: /.*/,
      exclude: /node_modules/
    },
    plugins: [],
  }, config));

  if (!config.entries) {
    console.log(chalk.red('[reboost] No entry found. Please add some entries first.'));
    process.exit(1);
  }

  if (config.rootDir.startsWith('.')) config.rootDir = path.resolve(config.rootDir);
  if (config.cacheDir.startsWith('.')) config.cacheDir = path.resolve(config.rootDir, config.cacheDir);
  if (!config.watchOptions.include) {
    config.watchOptions.include = /.*/;
  }
  if (config.contentServer && config.contentServer.root.startsWith('.')) {
    config.contentServer.root = path.resolve(config.rootDir, config.contentServer.root);
  }

  config.plugins.push(...defaultPlugins);
  const pluginNames = config.plugins.map(({ name }) => name);

  if (!pluginNames.includes(esbuildPluginName)) {
    config.plugins.push(esbuildPlugin());
  }
  if (!pluginNames.includes(CSSPluginName)) {
    config.plugins.unshift(CSSPlugin());
  }

  if (config.dumpCache && config.debugMode) rmDir(config.cacheDir);

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
  let fullAddress: string;

  interfaceLoop: for (const dev in interfaces) {
    for (const details of interfaces[dev]) {
      if (details.family === 'IPv4' && details.internal === false) {
        host = details.address;
        port = await portFinder.getPortPromise({ host });
        break interfaceLoop;
      }
    }
  }

  if (!host && !port) {
    host = 'localhost';
    port = await portFinder.getPortPromise();
  }

  fullAddress = `http://${host}:${port}`;
  setAddress(fullAddress);

  for (const [input, output, libName] of config.entries) {
    const outputPath = path.resolve(config.rootDir, output);
    ensureDir(path.dirname(outputPath));

    let fileContent = `import '${fullAddress}/setup';\n`;
    fileContent += 'import';
    if (libName) fileContent += ' * as _$lib$_ from';
    fileContent += ` '${fullAddress}/transformed?q=${encodeURI(path.resolve(config.rootDir, input))}';\n`;
    if (libName) fileContent += `window['${libName}'] = _$lib$_;\n`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(chalk.cyan(`[reboost] Generated: ${input} -> ${output}`));
  }

  if (config.debugMode) {
    // let idx = 0;
    // app.use(async (ctx, next) => {
    //   const current = idx++;
    //   console.time(chalk.cyan(`[reboost] Response time ${current}`));
    //   await next();
    //   console.timeEnd(chalk.cyan(`[reboost] Response time ${current}`));
    // });
  }

  app.ws.use((ctx) => {
    setWebSocket(ctx.websocket);
  });

  const setupPromises = [];
  for (const plugin of config.plugins) {
    if (plugin.setup) setupPromises.push(plugin.setup({ config, app, router }));
  }
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
        if (config.contentServer.onReady) config.contentServer.onReady(contentServer);

        const startedAt = (address: string) => {
          console.log(chalk.green(`[reboost] Content server started at: http://${address}`));
        }

        const localPort = await portFinder.getPortPromise();
        http.createServer(contentServer.callback()).listen(
          localPort,
          () => startedAt(`localhost:${localPort}`)
        );

        if (host !== 'localhost') {
          const ipPort = await portFinder.getPortPromise({ host });
          http.createServer(contentServer.callback()).listen(
            ipPort,
            host,
            () => startedAt(`${host}:${ipPort}`)
          );
        }
      }
    });
}
