/* eslint-disable @typescript-eslint/require-await */

import Koa, { Context } from 'koa';
import withWebSocket from 'koa-websocket';
import cors from '@koa/cors';
import Router from '@koa/router';

import fs from 'fs';
import path from 'path';

import { fileRequestHandler } from './file-handler';
import { getAddress, getConfig } from './shared';

const webSockets = new Set<Context['websocket']>();

export const createRouter = () => {
  const router = new Router();

  router.get('/transformed', fileRequestHandler);

  const loadSetupCode = () => (
    fs.readFileSync(path.resolve(__dirname, '../browser/setup.js')).toString()
  );
  const setupCode = loadSetupCode();
  router.get('/setup', async (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
    ctx.body += `const debugMode = ${getConfig().debugMode};\n\n`;
    ctx.body += getConfig().debugMode ? loadSetupCode() : setupCode;
  });

  router.get('/raw', async (ctx) => {
    const filePath = ctx.query.q;
    if (fs.existsSync(filePath)) ctx.body = await fs.promises.readFile(filePath);
  });

  const hmrCode = fs.readFileSync(path.resolve(__dirname, '../browser/hmr.js')).toString();
  router.get('/hmr', async (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
    ctx.body += `const filePath = ${JSON.stringify(ctx.query.q)};\n\n`;
    ctx.body += hmrCode;
  });

  const importerCode = fs.readFileSync(path.resolve(__dirname, '../browser/importer.js')).toString();
  router.get('/importer', async (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n`;
    ctx.body += importerCode;
  });

  router.get('/unresolved', async (ctx) => {
    const { query } = ctx;
    ctx.type = 'text/javascript';
    ctx.body = `
      console.error('[reboost] Unable to resolve import ${JSON.stringify(query.import)} of ${JSON.stringify(query.importer)}');
    `.trim();
  });

  router.get('/resolve', async (ctx) => {
    const relativeTo = ctx.query.from;
    const pathToResolve = ctx.query.to;
    let finalPath: string;

    for (const plugin of getConfig().plugins) {
      if (plugin.resolve) {
        const resolvedPath = await plugin.resolve(pathToResolve, relativeTo);
        if (resolvedPath) {
          finalPath = resolvedPath;
          break;
        }
      }
    }

    if (finalPath) {
      ctx.type = 'text/plain';
      ctx.body = finalPath;
    }
  });

  return router;
}

export const createProxyServer = (): [Koa, () => Koa, Router] => {
  const proxyServer = withWebSocket(new Koa());
  const router = createRouter();

  proxyServer.ws.use(({ websocket }) => {
    webSockets.add(websocket);
    websocket.on('close', () => webSockets.delete(websocket));
  });

  return [
    proxyServer,
    () => {
      proxyServer
        .use(cors({ origin: '*' }))
        .use(router.routes())
        .use(router.allowedMethods());
      
      return proxyServer;
    },
    router
  ];
}

export const messageClient = (message: string | Record<string, string>) => {
  webSockets.forEach((ws) => ws.send(JSON.stringify(message)));
}
