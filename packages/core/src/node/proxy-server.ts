import Koa from 'koa';
import cors from '@koa/cors';
import WebSocket from 'ws';

import fs from 'fs';
import path from 'path';

import { ReboostInstance } from './index';
import { resolveDependency } from './transformer/import-resolver';
import { createFileHandler } from './file-handler';
import { onServerCreated, uniqueID } from './utils';

const webSockets = new Set<WebSocket>();

export const createRouter = (instance: ReboostInstance): Koa.Middleware => {
  const routedPaths: Record<string, (ctx: Koa.Context) => void | Promise<void>> = {};

  routedPaths['/transformed'] = createFileHandler(instance);

  const loadSetupCode = () => (
    fs.readFileSync(path.resolve(__dirname, '../browser/setup.js')).toString()
  );
  const setupCode = loadSetupCode();

  routedPaths['/setup'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${instance.proxyAddress}";\n`;
    ctx.body += `const debugMode = ${instance.config.debugMode};\n`;
    ctx.body += `const mode = "${instance.config.mode}";\n`;
    ctx.body += `const hotReload = ${instance.config.hotReload};\n\n`;
    ctx.body += instance.config.debugMode ? loadSetupCode() : setupCode;
  }

  const eTagKey = uniqueID(10) + '-';
  routedPaths['/raw'] = async (ctx) => {
    const filePath = ctx.query.q;
    try {
      const stat = await fs.promises.stat(filePath);
      const etag = eTagKey + Math.floor(stat.mtimeMs);
      if (ctx.get('If-None-Match') === etag) {
        ctx.status = 304;
      } else {
        ctx.body = fs.createReadStream(filePath);
        ctx.set('Content-Length', stat.size + '');
        ctx.set('ETag', etag);
      }
    } catch (e) {/* The file probably doesn't exist */}
  }

  const hotCode = fs.readFileSync(path.resolve(__dirname, '../browser/hot.js')).toString();

  routedPaths['/hot'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${instance.proxyAddress}";\n`;
    ctx.body += `const filePath = ${JSON.stringify(ctx.query.q)};\n\n`;
    ctx.body += hotCode;
  }

  const importerCode = fs.readFileSync(path.resolve(__dirname, '../browser/importer.js')).toString();

  routedPaths['/importer'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${instance.proxyAddress}";\n`;
    ctx.body += `const commonJSInteropMode = ${instance.config.commonJSInterop.mode};\n\n`;
    ctx.body += importerCode;
  }

  routedPaths['/unresolved'] = (ctx) => {
    const { query } = ctx;
    ctx.type = 'text/javascript';
    ctx.body = `
      console.error('[reboost] Unable to resolve import ${JSON.stringify(query.import)} of ${JSON.stringify(query.importer)}');
    `.trim();
  }

  routedPaths['/resolve'] = async (ctx) => {
    const relativeTo: string = ctx.query.from;
    const pathToResolve: string = ctx.query.to;
    const finalPath = await resolveDependency(instance, pathToResolve, relativeTo);

    if (finalPath) {
      ctx.type = 'text/plain';
      ctx.body = finalPath;
    }
  }

  return async (ctx, next) => {
    if (routedPaths[ctx.path]) {
      await routedPaths[ctx.path](ctx);
    }
    return next();
  }
}

export const createProxyServer = (instance: ReboostInstance) => {
  const proxyServer = new Koa();
  const router = createRouter(instance);

  proxyServer
    .use(cors({ origin: '*' }))
    .use(router);

  onServerCreated(proxyServer, (server) => {
    const wss = new WebSocket.Server({ server });
    wss.on('connection', (socket) => {
      webSockets.add(socket);
      socket.on('close', () => webSockets.delete(socket));
    });
    instance.onStop("Closes proxy server's websocket", () => wss.close());
  });

  return proxyServer;
}

export const messageClient = (message: string | Record<string, string>) => {
  webSockets.forEach((ws) => ws.send(JSON.stringify(message)));
}
