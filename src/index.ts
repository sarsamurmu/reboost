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

import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import http from 'http';

import setupFunc from './client';
import { merge, ensureDir, rmDir } from './utils';
import { setAddress, setConfig, setWebSocket } from './shared';
import { fileRequestHandler, verifyFiles } from './file-handler';

export * as plugins from './plugins';

const trim = (string: string) => string.split('\n').map((part) => part.trim()).join('\n');

export interface LoadedData {
  code: string;
  original?: string;
  map?: string;
}

export interface TransformedContent {
  code: string;
  map: string;
}

export interface ReboostPlugin {
  setup?: (config: ReboostConfig) => void | Promise<void>;
  resolve?: (importPath: string, importer: string) => string | Promise<string>;
  load?: (filePath: string) => LoadedData | Promise<LoadedData>;
  transformContent?: (code: string, filePath: string) => TransformedContent | Promise<TransformedContent>;
  transformAST?: (
    ast: babelTypes.Node,
    babel: {
      traverse: typeof babelTraverse;
      types: typeof babelTypes;
    },
    filePath: string
  ) => void | Promise<void>;
}

export interface ReboostConfig {
  /** Path of the directory to be used by reboost to cache files */
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

export const start = async (config: ReboostConfig = {} as any) => {
  config = setConfig(merge<ReboostConfig>({
    cacheDir: './.reboost_cache',
    entries: null,
    rootDir: '.',
    resolve: {
      alias: {},
      extensions: ['.mjs', '.js', '.json'],
      mainFiles: ['index'],
      modules: ['node_modules']
    },
    watchOptions: {
      exclude: /node_modules/
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
    config.watchOptions.include = config.resolve.extensions.map((ext) => new RegExp(ext + '$'));
  }
  if (config.contentServer && config.contentServer.root.startsWith('.')) {
    config.contentServer.root = path.resolve(config.rootDir, config.contentServer.root);
  }

  if (config.dumpCache && config.debugMode) rmDir(config.cacheDir);

  if (fs.existsSync(config.cacheDir)) {
    console.log(chalk.green('[reboost] Refreshing cache...'));
    verifyFiles();
    console.log(chalk.green('[reboost] Refresh cache complete'));
  }

  console.log(chalk.green('[reboost] Starting proxy server...'));
  
  let host: string;
  let port: number;
  let fullAddress: string;
  const interfaces = networkInterfaces();

  interfaceLoop: for (const dev in interfaces) {
    for (const details of interfaces[dev]) {
      if (details.family === 'IPv4' && details.internal === false) {
        host = details.address;
        port = await portFinder.getPortPromise({ host });
        fullAddress = `http://${host}:${port}`;
        setAddress(fullAddress);
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
    fs.writeFileSync(outputPath, trim(
      `import '${fullAddress}/client';
      import ${libName ? '* as _$lib$_ from' : ''} '${fullAddress}/transformed?q=${encodeURI(path.resolve(config.rootDir, input))}';
      ${libName ? `window['${libName}'] = _$lib$_;`: ''}
      `
    ));
    console.log(chalk.cyan(`[reboost] Generated: ${input} -> ${output}`));
  }

  const app = withWebSocket(new Koa());
  const router = new Router();

  if (config.debugMode) {
    let idx = 0;
    app.use(async (ctx, next) => {
      const current = idx++;
      console.time(chalk.cyan(`[reboost] Response time ${current}`));
      await next();
      console.timeEnd(chalk.cyan(`[reboost] Response time ${current}`));
    });
  }

  app.ws.use((ctx) => {
    setWebSocket(ctx.websocket);
  });

  router.get('/transformed', fileRequestHandler);

  router.get('/client', async (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `(${setupFunc.toString()})('${host}:${port}')`;
  });

  router.get('/raw', async (ctx) => {
    const filePath = ctx.query.q;
    if (fs.existsSync(filePath)) ctx.body = fs.readFileSync(filePath);
  });

  router.get('/unresolved', async (ctx) => {
    const { query } = ctx;
    ctx.type = 'text/javascript';
    ctx.body = `
      console.error('[reboost] Unable to resolve import ${JSON.stringify(query.import)} of ${JSON.stringify(query.importer)}')
    `.trim();
  });

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
