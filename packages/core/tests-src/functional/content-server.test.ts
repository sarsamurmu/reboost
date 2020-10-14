import Koa from 'koa';
import http from 'http';
import fs from 'fs';

import { start } from 'src-node/index';

import { createFixture } from '../helpers/fixture';
import { newPage } from '../helpers/browser';

jest.setTimeout(15000);

test('serves directory listing', async () => {
  const fixture = createFixture({
    'public': {
      'dir-1': {},
      'file-1.html': '',
      'file-2.html': ''
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      index: false,
      serveIndex: true
    },
    log: false
  });
  const page = await newPage();

  await page.goto(service.contentServer.local);
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toMatch('dir-1/');
  expect(bodyText).toMatch('file-1.html');
  expect(bodyText).toMatch('file-2.html');

  await service.stop();

  const service2 = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      serveIndex: false
    },
    log: false
  });

  expect((await page.goto(service2.contentServer.local)).status()).toBe(404);

  await service2.stop();
});

test('loads index file', async () => {
  const fixture = createFixture({
    'public': {
      'my-index.html': '<html><body>This is my-index.html file</body></html>'
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      index: 'my-index.html'
    },
    log: false
  });
  const page = await newPage();

  await page.goto(service.contentServer.local);
  expect(await page.evaluate(() => document.body.innerText)).toMatch('This is my-index.html file');

  await service.stop();
});

test('resolves extensions', async () => {
  const fixture = createFixture({
    'public': {
      'html-file.html': '<html><body>HTML file</body></html>',
      'htm-file.htm': '<html><body>HTM file</body></html>'
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      extensions: ['.html', '.htm']
    },
    log: false
  });
  const page = await newPage();

  await page.goto(`${service.contentServer.local}/html-file`);
  const getBodyText = () => document.body.innerText;
  expect(await page.evaluate(getBodyText)).toMatch('HTML file');
  await page.goto(`${service.contentServer.local}/htm-file`);
  expect(await page.evaluate(getBodyText)).toMatch('HTM file');

  await service.stop();
});

describe('supports middleware', () => {
  const fixture = createFixture({ 'public': {} }).apply();

  test('single', async () => {
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [],
      contentServer: {
        root: './public',
        middleware: async (ctx, next) => {
          if (ctx.path === '/my-endpoint') ctx.body = 'Middleware working';
          await next();
        }
      },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/my-endpoint`);
    expect(await page.content()).toMatch('Middleware working');

    await service.stop();
  });

  test('multiple', async () => {
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [],
      contentServer: {
        root: './public',
        middleware: [
          async (ctx, next) => {
            if (ctx.path === '/my-endpoint') ctx.body = 'Middleware 1 working\n\n';
            await next();
          },
          async (ctx, next) => {
            if (ctx.path === '/my-endpoint') ctx.body += 'Middleware 2 working';
            await next();
          }
        ]
      },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/my-endpoint`);
    const pageContent = await page.content();
    expect(pageContent).toMatch('Middleware 1 working');
    expect(pageContent).toMatch('Middleware 2 working');

    await service.stop();
  });
});

test('redirects using proxy', async () => {
  const fixture = createFixture({ 'public': {} }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      proxy: {
        '/test': 'http://localhost:4182',
        '/root': {
          target: 'http://localhost:4182',
          rewrite: () => '/'
        }
      }
    },
    log: false
  });
  const page = await newPage();

  const mockProxyServer = await new Promise<http.Server>((res) => {
    const server = new Koa().use((ctx) => {
      if (ctx.path === '/test') ctx.body = 'test:proxy';
      if (ctx.path === '/') ctx.body = 'root:proxy';
    }).listen(4182, () => res(server));
  });

  await page.goto(`${service.contentServer.local}/test`);
  expect(await page.content()).toMatch('test:proxy');
  await page.goto(`${service.contentServer.local}/root`);
  expect(await page.content()).toMatch('root:proxy');

  await new Promise((res) => mockProxyServer.close(res));
  await service.stop();
});

test('serves content on basePath', async () => {
  const fixture = createFixture({
    'public/main.html': '<html><body>Content</body></html>'
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [],
    contentServer: {
      root: './public',
      basePath: '/custom-base'
    },
    log: false
  });
  const page = await newPage();

  expect(service.contentServer.local).toMatch('/custom-base');
  expect((await page.goto(`${service.contentServer.local.replace('/custom-base', '')}`)).status()).toBe(404);
  await page.goto(`${service.contentServer.local}/main.html`);
  expect(await page.evaluate(() => document.body.innerText)).toMatch('Content');

  await service.stop();
});

describe('file watcher', () => {
  test('reloads page when file changes', async () => {
    const fixture = createFixture({
      'public/main.html': '<html><body>A HTML file</body></html>'
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [],
      contentServer: {
        root: './public'
      },
      log: false
    });
    const page = await newPage();

    // `networkidle0` - So that WebSocket can connect
    await page.goto(`${service.contentServer.local}/main.html`, { waitUntil: 'networkidle0' });
    const getBodyText = () => document.body.innerText;
    expect(await page.evaluate(getBodyText)).toMatch('A HTML file');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      fs.promises.writeFile(
        fixture.p('./public/main.html'),
        '<html><body>A new HTML file</body></html>'
      )
    ]);
    expect(await page.evaluate(getBodyText)).toMatch('A new HTML file');

    const [response] = await Promise.all([
      page.waitForNavigation(),
      fs.promises.unlink(fixture.p('./public/main.html'))
    ]);
    expect(response.status()).toBe(404);

    await service.stop();
  });

  test('reloads blank HTML document', async () => {
    const fixture = createFixture({
      'public/main.html': ''
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [],
      contentServer: {
        root: './public'
      },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/main.html`, { waitUntil: 'networkidle0' });
    const getBodyText = () => document.body.innerText;
    expect((await page.evaluate(getBodyText)).trim()).toBe('');
    await Promise.all([
      page.waitForNavigation(),
      fs.promises.writeFile(
        fixture.p('./public/main.html'),
        '<html><body>Content</body></html>'
      )
    ]);
    expect(await page.evaluate(getBodyText)).toMatch('Content');

    await service.stop();
  });

  test('hot reloads CSS when CSS files change', async () => {
    const fixture = createFixture({
      'public': {
        'main.html': `
          <html>
            <head>
              <link rel="stylesheet" href="./styles.css">
            </head>
            <body>
              <p class="main">Main element</p>
            </body>
          </html>
        `,
        'styles.css': '.main { color: rgb(0, 0, 255) }'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [],
      contentServer: {
        root: './public'
      },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/main.html`, { waitUntil: 'networkidle0' });
    const getElementColor = () => getComputedStyle(document.querySelector('.main')).color;
    expect(await page.evaluate(getElementColor)).toBe('rgb(0, 0, 255)');
    await Promise.all([
      page.waitForResponse((req) => req.url().includes('styles.css')),
      fs.promises.writeFile(
        fixture.p('./public/styles.css'),
        '.main { color: rgb(255, 0, 0) }'
      )
    ]);
    expect(await page.evaluate(getElementColor)).toBe('rgb(255, 0, 0)');

    await service.stop();
  });
});
