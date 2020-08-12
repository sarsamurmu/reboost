import Koa, { Context } from 'koa';
import withWebSocket from 'koa-websocket';
import cors from '@koa/cors';

import fs from 'fs';
import path from 'path';

import { createFileHandler } from './file-handler';
import { getAddress, getConfig, getPlugins } from './shared';

const webSockets = new Set<Context['websocket']>();

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
    const relativeTo = ctx.query.from;
    const pathToResolve = ctx.query.to;
    let finalPath: string;

    for (const plugin of getPlugins()) {
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
  }

  return async (ctx, next) => {
    if (routedPaths[ctx.path]) {
      // TODO: Fix `as any`
      await routedPaths[ctx.path](ctx as any);
    }
    return next();
  }
}

export const createProxyServer = () => {
  const proxyServer = withWebSocket(new Koa());
  const router = createRouter();

  proxyServer.ws.use(({ websocket }) => {
    webSockets.add(websocket);
    websocket.on('close', () => webSockets.delete(websocket));
  });

  proxyServer
    .use(cors({ origin: '*' }))
    .use(router);

  return proxyServer;
}

export const messageClient = (message: string | Record<string, string>) => {
  webSockets.forEach((ws) => ws.send(JSON.stringify(message)));
}
