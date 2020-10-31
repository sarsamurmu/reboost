import { start } from 'src-node/index';

import { createFixture } from '../helpers/fixture';
import { newPage, waitForConsole } from '../helpers/browser';

test('serves regular CSS file', async () => {
  const fixture = createFixture({
    'main.html': '<script type="module" src="./main.js"></script>',
    'src': {
      'index.js': 'import "./index.css"',
      'index.css': 'body { background-color: rgb(0, 100, 0) }'
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [['./src/index.js', './main.js']],
    contentServer: { root: '.' },
    log: false
  });
  const page = await newPage();

  await page.goto(`${service.contentServer.local}/main.html`);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 100, 0)');

  await service.stop();
});

test('able to get content using .toString() method', async () => {
  const fixture = createFixture({
    'main.html': '<script type="module" src="./main.js"></script>',
    'src': {
      'index.js': `
        import css from "./index.css";
        console.log(css.toString());
      `,
      'index.css': 'body { background-color: rgb(0, 100, 0) }'
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [['./src/index.js', './main.js']],
    contentServer: { root: '.' },
    log: false
  });
  const page = await newPage();

  await Promise.all([
    waitForConsole(page, (msg) => msg.text().includes('rgb(0, 100, 0)')),
    await page.goto(`${service.contentServer.local}/main.html`)
  ]);

  await service.stop();
});

describe('resolves @imports', () => {
  test('without media', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./index.css"',
        'index.css': `
          @import "./imported_1.css";
          @import url("./imported_2.css");
          @import url(./imported_3.css);
        `,
        'imported_1.css': 'body { background-color: rgb(0, 100, 0) }',
        'imported_2.css': 'body { color: rgb(200, 0, 0) }',
        'imported_3.css': 'body { border-color: rgb(0, 0, 175) }'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/main.html`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 100, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(200, 0, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.body).borderColor)).toBe('rgb(0, 0, 175)');

    await service.stop();
  });

  test('with media', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./index.css"',
        'index.css': '@import "./imported_1.css" (min-width: 600px);',
        'imported_1.css': 'body { background-color: rgb(0, 100, 0) }'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false
    });
    const page = await newPage();

    await page.setViewport({ width: 700, height: 100 });
    await page.goto(`${service.contentServer.local}/main.html`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 100, 0)');
    await page.setViewport({ width: 500, height: 100 });
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

    await service.stop();
  });

  test('no relative using ~', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./index.css"',
        'index.css': '@import "~mod/imported.css";',
      },
      'node_modules/mod/imported.css': 'body { background-color: rgb(0, 100, 0) }'
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false
    });
    const page = await newPage();

    await page.goto(`${service.contentServer.local}/main.html`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 100, 0)');

    await service.stop();
  });

  test('does not resolve remote urls', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./index.css"',
        'index.css': '@import "https://my.site.com/base.css";',
      },
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false
    });
    const page = await newPage();

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('my.site.com')) {
        return request.respond({ body: 'body { background-color: rgb(255, 0, 0) }' });
      }
      request.continue();
    });
    await page.goto(`${service.contentServer.local}/main.html`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 0, 0)');

    await service.stop();
  });
});

describe('resolves url() and image-set()', () => {
  test('url()', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': `
          import css from "./index.css";
          console.log(css.toString());
        `,
        'index.css': `
          .sel {
            prop-one: url("./image.jpg");
            prop-two: url(./image.jpg);
          }
        `,
        'image.jpg': '-> Gets loaded by the mock plugin'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [{
        name: 'mock-plugin',
        load(filePath) {
          if (filePath === fixture.p('src/image.jpg')) return {
            code: 'export default "https://resolved.url"',
            type: 'js'
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, (msg) => {
        if (msg.location().url.includes('index.js')) {
          expect(msg.text().match(/url\(https:\/\/resolved\.url\)/g).length).toBe(2);
          return true;
        }
      }),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    await service.stop();
  });

  test('image-set()', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': `
          import css from "./index.css";
          console.log(css.toString());
        `,
        'index.css': `
          .sel {
            prop-one: image-set(
              "image_1x.jpg" 1x,
              "image_2x.jpg" 2x
            );
            prop-two: -webkit-image-set(
              "image_1x.jpg" 1x,
              "image_2x.jpg" 2x
            );
          }
        `,
        'image_1x.jpg': '-> Gets loaded by the mock plugin',
        'image_2x.jpg': '-> Gets loaded by the mock plugin'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [{
        name: 'mock-plugin',
        load(filePath) {
          const match = filePath.match(/image_(\d)x.jpg/);
          if (match) return {
            code: `export default "https://resolved.url/${match[1]}x"`,
            type: 'js'
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, (msg) => {
        if (msg.location().url.includes('index.js')) {
          // Note: image-set's urls are quoted
          expect(msg.text().match(/"https:\/\/resolved\.url\/1x"/g).length).toBe(2);
          expect(msg.text().match(/"https:\/\/resolved\.url\/2x"/g).length).toBe(2);
          return true;
        }
      }),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    await service.stop();
  });

  test('image-set(url())', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': `
          import css from "./index.css";
          console.log(css.toString());
        `,
        'index.css': `
          .sel {
            prop-one: image-set(
              url("image_1x.jpg") 1x,
              url("image_2x.jpg") 2x
            );
            prop-two: -webkit-image-set(
              url("image_1x.jpg") 1x,
              url("image_2x.jpg") 2x
            );
          }
        `,
        'image_1x.jpg': '-> Gets loaded by the mock plugin',
        'image_2x.jpg': '-> Gets loaded by the mock plugin'
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [{
        name: 'mock-plugin',
        load(filePath) {
          const match = filePath.match(/image_(\d)x.jpg/);
          if (match) return {
            code: `export default "https://resolved.url/${match[1]}x"`,
            type: 'js'
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, (msg) => {
        if (msg.location().url.includes('index.js')) {
          expect(msg.text().match(/url\(https:\/\/resolved\.url\/1x\)/g).length).toBe(2);
          expect(msg.text().match(/url\(https:\/\/resolved\.url\/2x\)/g).length).toBe(2);
          return true;
        }
      }),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    await service.stop();
  });

  test('no relative using ~', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': `
          import css from "./index.css";
          console.log(css.toString());
        `,
        'index.css': `
          .sel {
            prop-one: image-set(
              "~mod/image_1x.jpg" 1x,
              "~mod/image_2x.jpg" 2x
            );
            prop-two: url("~mod/image_1x.jpg");
          }
        `,
      },
      'node_modules': {
        'mod': {
          'image_1x.jpg': '-> Gets loaded by the mock plugin',
          'image_2x.jpg': '-> Gets loaded by the mock plugin'
        }
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [{
        name: 'mock-plugin',
        load(filePath) {
          const match = filePath.match(/image_(\d)x.jpg/);
          if (match) {
            expect(filePath).toMatch(fixture.p('node_modules/mod/image_'));
            return {
              code: `export default "https://resolved.url/${match[1]}x"`,
              type: 'js'
            }
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, (msg) => {
        if (msg.location().url.includes('index.js')) {
          expect(msg.text().match(/"https:\/\/resolved\.url\/1x"/g).length).toBe(1);
          expect(msg.text().match(/"https:\/\/resolved\.url\/2x"/g).length).toBe(1);
          expect(msg.text().match(/url\(https:\/\/resolved\.url\/1x\)/g).length).toBe(1);
          return true;
        }
      }),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    await service.stop();
  });

  test('does not resolve remote urls', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': `
          import css from "./index.css";
          console.log(css.toString());
        `,
        'index.css': `
          .sel {
            prop-one: image-set(
              "https://my.site.com/image_1x.jpg" 1x,
              "https://my.site.com/image_2x.jpg" 2x
            );
            prop-two: url("https://my.site.com/image_1x.jpg");
          }
        `,
      }
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
    });
    const page = await newPage();

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('my.site.com')) {
        return request.respond({ body: '' });
      }
      request.continue();
    });
    await Promise.all([
      waitForConsole(page, (msg) => {
        if (msg.location().url.includes('index.js')) {
          expect(msg.text().match(/"https:\/\/my\.site\.com\/image_1x\.jpg"/g).length).toBe(2);
          expect(msg.text().match(/"https:\/\/my\.site\.com\/image_2x\.jpg"/g).length).toBe(1);
          return true;
        }
      }),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    await service.stop();
  });
});
