import Koa from 'koa';
import cors from '@koa/cors';
import WebSocket from 'ws';

import fs from 'fs';
import path from 'path';

import { resolveDependency } from './transformer/import-resolver';
import { createFileHandler } from './file-handler';
import { getAddress, getConfig, addServiceStopper } from './shared';
import { onServerCreated } from './utils';

const webSockets = new Set<WebSocket>();

export const createRouter = (): Koa.Middleware => {
  const routedPaths: Record<string, (ctx: Koa.Context) => void | Promise<void>> = {};

  routedPaths['/transformed'] = createFileHandler();

  const loadSetupCode = () => (
    fs.readFileSync(path.resolve(__dirname, '../browser/setup.js')).toString()
  );
  const setupCode = loadSetupCode();

  routedPaths['/setup'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
    ctx.body += `const debugMode = ${getConfig().debugMode};\n\n`;
    ctx.body += getConfig().debugMode ? loadSetupCode() : setupCode;
  }

  routedPaths['/raw'] = async (ctx) => {
    const filePath = ctx.query.q;
    if (fs.existsSync(filePath)) ctx.body = await fs.promises.readFile(filePath);
  }

  const hmrCode = fs.readFileSync(path.resolve(__dirname, '../browser/hmr.js')).toString();

  routedPaths['/hmr'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
    ctx.body += `const filePath = ${JSON.stringify(ctx.query.q)};\n\n`;
    ctx.body += hmrCode;
  }

  const importerCode = fs.readFileSync(path.resolve(__dirname, '../browser/importer.js')).toString();

  routedPaths['/importer'] = (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
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
    const finalPath = await resolveDependency(pathToResolve, relativeTo);

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

export const createProxyServer = () => {
  const proxyServer = new Koa();
  const router = createRouter();

  proxyServer
    .use(cors({ origin: '*' }))
    .use(router);

  onServerCreated(proxyServer, (server) => {
    const wss = new WebSocket.Server({ server });
    wss.on('connection', (socket) => {
      webSockets.add(socket);
      socket.on('close', () => webSockets.delete(socket));
    });
    addServiceStopper('Proxy server websocket', () => wss.close());
  });

  return proxyServer;
}

export const messageClient = (message: string | Record<string, string>) => {
  webSockets.forEach((ws) => ws.send(JSON.stringify(message)));
}
