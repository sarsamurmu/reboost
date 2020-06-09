import Router from '@koa/router';

import fs from 'fs';
import path from 'path';

import { fileRequestHandler } from './file-handler';
import { getAddress, getConfig } from './shared';

export const createRouter = () => {
  const router = new Router();

  router.get('/transformed', fileRequestHandler);

  const setupCode = fs.readFileSync(path.resolve(__dirname, '../browser/setup.js')).toString();
  router.get('/setup', async (ctx) => {
    ctx.type = 'text/javascript';
    ctx.body = `const address = "${getAddress()}";\n\n${setupCode}`;
  });

  router.get('/raw', async (ctx) => {
    const filePath = ctx.query.q;
    if (fs.existsSync(filePath)) ctx.body = fs.readFileSync(filePath);
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
