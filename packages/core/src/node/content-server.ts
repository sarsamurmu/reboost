import Koa from 'koa';
import proxy, { IKoaProxiesOptions as ProxyOptions } from 'koa-proxies';
import serveStatic from 'koa-static';

import fs from 'fs';
import path from 'path';

import { getConfig } from './shared';

export const serveDirectory = () => {
  const { contentServer: { root } } = getConfig();
  const styles = /* css */`
    @import url(https://fonts.googleapis.com/css2?family=Sora:wght@400&display=swap);

    * {
      font-family: 'Sora', sans-serif;
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
      font-size: 1.1rem;
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
      height: 1.5rem;
      width: 1.5rem;
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
  `;

  // eslint-disable-next-line @typescript-eslint/require-await
  return async (ctx: Koa.Context) => {
    const dirPath = path.join(root, ctx.path);
    const fullPath = (file: string) => path.join(dirPath, file);

    if (
      !fs.existsSync(dirPath) ||
      !fs.lstatSync(dirPath).isDirectory()
    ) return;

    const all = fs.readdirSync(dirPath);
    const directories = all.filter((file) => fs.lstatSync(fullPath(file)).isDirectory()).sort();
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
            ${directories.concat(files).map((file) => {
              const full = file + (directories.includes(file) ? '/' : '');
              return `
                <li>
                  <a
                    href="./${full}">
                    <span icon="${directories.includes(file) ? 'directory' : 'file'}"></span>
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

export const createContentServer = () => {
  const contentServer = new Koa();
  const config = getConfig();

  const proxyObject = config.contentServer.proxy;
  if (proxyObject) {
    for (const key in proxyObject) {
      const proxyOptions: ProxyOptions = typeof proxyObject[key] === 'string'
        ? { target: proxyObject[key] as string }
        : proxyObject[key] as ProxyOptions;

      contentServer.use(proxy(key, proxyOptions));
    }
  }

  contentServer.use(serveStatic(config.contentServer.root, config.contentServer));
  contentServer.use(serveDirectory());

  if (config.contentServer.onReady) config.contentServer.onReady(contentServer);

  return contentServer;
}
