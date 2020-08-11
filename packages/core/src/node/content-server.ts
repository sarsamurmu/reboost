import Koa from 'koa';
import proxy, { IKoaProxiesOptions as ProxyOptions } from 'koa-proxies';
import sendFile, { SendOptions } from 'koa-send';
import withWebsocket from 'koa-websocket';
import { parse as parseHTML } from 'node-html-parser';
import chalk from 'chalk';
import { FSWatcher } from 'chokidar';

import fs from 'fs';
import path from 'path';

import { getConfig } from './shared';
import { isDirectory, uniqueID, getTimestamp } from './utils';

const createDirectoryServer = () => {
  const styles = /* css */`
    * {
      font-family: monospace;
      --link: rgb(0, 0, 238);
    }

    body {
      padding: 20px;
    }

    h2 {
      font-weight: normal;
    }

    ul {
      padding-inline-start: 20px;
    }

    li {
      list-style: none;
    }

    li a {
      padding: 5px 0px;
      text-decoration: none;
      font-size: 1.2rem;
      color: var(--link);
      border-bottom-style: solid;
      border-width: 2px;
      border-color: transparent;
      transition: 0.05s;
      display: flex;
      align-items: center;
    }

    li a:hover {
      border-color: var(--link);
    }

    li a:visited {
      color: var(--link);
    }

    [icon] {
      --size: 1.5rem;
      height: var(--size);
      width: var(--size);
      display: inline-block;
      margin-right: 0.5rem;
    }

    /* Icons are from https://materialdesignicons.com/ */

    [icon=directory] {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='width:24px;height:24px' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z' /%3E%3C/svg%3E");
    }

    [icon=file] {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='width:24px;height:24px' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z' /%3E%3C/svg%3E");
    }

    [icon=go-up] {
      transform: rotate(90deg);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='width:24px;height:24px' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M11,9L12.42,10.42L8.83,14H18V4H20V16H8.83L12.42,19.58L11,21L5,15L11,9Z' /%3E%3C/svg%3E");
    }
  `;

  return (ctx: Koa.Context, root: string) => {
    const dirPath = path.join(root, ctx.path);

    if (
      !fs.existsSync(dirPath) ||
      !isDirectory(dirPath)
    ) return;

    const all = fs.readdirSync(dirPath);
    const directories = all.filter((file) => isDirectory(path.join(dirPath, file))).sort();
    const files = all.filter((file) => !directories.includes(file)).sort();

    /* eslint-disable indent */
    ctx.type = 'text/html';
    ctx.body = /* html */`
      <!doctype html>
      <html>
        <head>
          <title>Index of ${ctx.path}</title>
          <style>${styles}</style>
        </head>
        <body>
          <h2>Index of ${ctx.path}</h2>
          <ul>
            ${ctx.path !== '/' ? /* html */`
              <li>
                <a href="${path.join(ctx.path, '..')}">
                  <i icon="go-up"></i>
                  Go up
                </a>
              <li>
            ` : ''}
            ${directories.concat(files).map((file) => {
                const isDir = directories.includes(file);
                const full = file + (isDir ? '/' : '');

                return /* html */`
                  <li>
                    <a href="./${full}">
                      <i icon="${isDir ? 'directory' : 'file'}"></i>
                      ${full}
                    </a>
                  </li>
                `;
              }).join('\n')}
          </ul>
        </body>
      </html>
    `;
    /* eslint-enable indent */
  }
}

const createFileServer = () => {
  const sendDirectory = createDirectoryServer();
  const { contentServer, debugMode } = getConfig();
  const { root } = contentServer;
  const sendOptions: SendOptions & { root: string } = {
    root,
    extensions: contentServer.extensions,
    hidden: contentServer.hidden,
    index: contentServer.index
  }

  // TODO: Remove it in v1.0
  for (const key in contentServer) {
    if (['maxage', 'maxAge', 'immutable', 'gzip', 'brotli', 'format', 'setHeaders', 'onReady'].includes(key)) {
      console.log(chalk.yellow(`Option "${key}" is now no longer available in "config.contentServer".\n`));
    }
  }

  const loadInitCode = () => fs.readFileSync(path.join(__dirname, '../browser/content-server.js')).toString();
  const initCode = loadInitCode();
  const initScriptPath = `/reboost-${uniqueID(10)}`;
  const webSockets = new Set<Koa.Context['websocket']>();
  const watcher = new FSWatcher();
  const watchedFiles = new Set<string>();

  const triggerReload = (isCSS = false) => {
    webSockets.forEach((ws) => ws.send(JSON.stringify(isCSS)));
  }

  const rootRelative = (filePath: string) => path.relative(getConfig().rootDir, filePath);

  watcher.on('change', (filePath) => {
    console.log(chalk.blue(`${getTimestamp()} Changed: ${rootRelative(filePath)}`));

    triggerReload(path.extname(filePath) === '.css');
  });
  
  watcher.on('unlink', (filePath) => {
    console.log(chalk.blue(`${getTimestamp()} Deleted: ${rootRelative(filePath)}`));

    watchedFiles.delete(path.normalize(filePath));
    triggerReload();
  });

  const websocketMiddleware = ({ websocket }: Koa.Context) => {
    webSockets.add(websocket);
    websocket.on('close', () => webSockets.delete(websocket));
  }

  const koaMiddleware = async (ctx: Koa.Context, next: Koa.Next) => {
    let sentFilePath;

    if (ctx.path === initScriptPath) {
      ctx.type = 'text/javascript';
      ctx.body = `const debugMode = ${getConfig().debugMode};\n\n`;
      ctx.body += debugMode ? loadInitCode() : initCode;
      return next();
    }

    try {
      sentFilePath = await sendFile(ctx, ctx.path, sendOptions);
      sentFilePath = path.normalize(sentFilePath);
    } catch (err) {/* Ignored */}

    if (sentFilePath) {
      if (!watchedFiles.has(sentFilePath)) {
        watcher.add(sentFilePath);
        watchedFiles.add(sentFilePath);
      }

      if (/^\.html?$/.test(path.extname(sentFilePath))) {
        const htmlSource = await new Promise<string>((res) => {
          const stream = ctx.body as fs.ReadStream;
          const chunks: Buffer[] = [];

          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => res(Buffer.concat(chunks).toString()));
        });

        const htmlRoot = parseHTML(htmlSource, {
          comment: true,
          script: true,
          style: true,
          pre: true
        });
        const body = htmlRoot.querySelector('body');

        if (body) {
          body.appendChild(parseHTML(`<script src="${initScriptPath}"></script>`));
        }

        ctx.body = htmlRoot.toString();
        ctx.remove('Content-Length');
      }

      return next();
    }

    sendDirectory(ctx, root);

    await next();
  }

  return [koaMiddleware, websocketMiddleware] as const;
}

export const createContentServer = () => {
  const contentServer = withWebsocket(new Koa());
  const config = getConfig();
  const [koaMiddleware, websocketMiddleware] = createFileServer();

  const { middleware } = config.contentServer;
  if (middleware) {
    [].concat(middleware).forEach((fn) => contentServer.use(fn));
  }

  const proxyObject = config.contentServer.proxy;
  if (proxyObject) {
    for (const key in proxyObject) {
      const proxyOptions: ProxyOptions = typeof proxyObject[key] === 'string'
        ? { target: proxyObject[key] as string }
        : proxyObject[key] as ProxyOptions;

      contentServer.use(proxy(key, proxyOptions));
    }
  }

  contentServer.ws.use(websocketMiddleware);
  contentServer.use(koaMiddleware);

  return contentServer;
}
