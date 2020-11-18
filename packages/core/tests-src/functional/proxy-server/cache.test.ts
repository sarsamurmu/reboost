import fs from 'fs';

import { ReboostConfig, start } from 'src-node/index';

import { newPage, waitForConsole } from '../../helpers/browser';
import { createFixture } from '../../helpers/fixture';

describe('updates cache', () => {
  test('when file changes', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src/index.js': 'console.log("Works")'
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      includeDefaultPlugins: false,
      log: false
    });
    const page = await newPage();

    const [response1] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'Works'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(response1.headers()).toHaveProperty('etag');

    const [response2] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      page.reload()
    ]);
    expect(response2.status()).toBe(304);

    fs.writeFileSync(fixture.p('./src/index.js'), 'console.log("Updated")');

    const [response3] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'Updated'),
      page.reload()
    ]);
    expect(response3.headers()).toHaveProperty('etag');
    expect(response3.headers().etag).not.toBe(response1.headers().etag);

    await service.stop();
  });

  test('when dependency changes', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'console.log(__DEP__)',
        'dep.txt': 'A text'
      },
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      includeDefaultPlugins: false,
      log: false,
      plugins: [{
        name: 'mock-plugin',
        getCacheKey: () => 0,
        transformContent({ code }, filePath) {
          if (filePath === fixture.p('src/index.js')) {
            const dependencyPath = fixture.p('src/dep.txt');
            this.addDependency(dependencyPath);
            return {
              code: code.replace('__DEP__', JSON.stringify(fs.readFileSync(dependencyPath).toString())),
              map: undefined
            }
          }
        }
      }]
    });
    const page = await newPage();

    const [response1] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'A text'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(response1.headers()).toHaveProperty('etag');

    const [response2] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      page.reload()
    ]);
    expect(response2.status()).toBe(304);

    fs.writeFileSync(fixture.p('src/dep.txt'), 'Updated text');

    const [response3] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'Updated text'),
      page.reload()
    ]);
    expect(response3.headers()).toHaveProperty('etag');
    expect(response3.headers().etag).not.toBe(response1.headers().etag);

    await service.stop();
  });

  test('when dependency gets deleted', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'console.log(__HAS_DEP__)',
        'dep.txt': ''
      },
    }).apply();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      includeDefaultPlugins: false,
      log: false,
      plugins: [{
        name: 'mock-plugin',
        getCacheKey: () => 0,
        transformContent({ code }, filePath) {
          if (filePath === fixture.p('src/index.js')) {
            const dependencyPath = fixture.p('src/dep.txt');
            this.addDependency(dependencyPath);
            return {
              code: code.replace('__HAS_DEP__', fs.existsSync(dependencyPath) + ''),
              map: undefined
            }
          }
        }
      }]
    });
    const page = await newPage();

    const [response1] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'true'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(response1.headers()).toHaveProperty('etag');

    const [response2] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      page.reload()
    ]);
    expect(response2.status()).toBe(304);

    fs.unlinkSync(fixture.p('src/dep.txt'))

    const [response3] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('index.js')),
      waitForConsole(page, 'false'),
      page.reload()
    ]);
    expect(response3.headers()).toHaveProperty('etag');
    expect(response3.headers().etag).not.toBe(response1.headers().etag);

    await service.stop();
  });

  test('when plugins change', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'console.log(true)'
      },
    }).apply();
    const commonOpts: ReboostConfig = {
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      includeDefaultPlugins: false,
      log: false,
    }
    const service1 = await start({
      ...commonOpts,
      plugins: [{
        name: 'true-to-false',
        getCacheKey: () => 0,
        transformContent({ code }) {
          return {
            code: code.replace('true', 'false'),
            map: undefined
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, 'false'),
      page.goto(`${service1.contentServer.local}/main.html`)
    ]);

    await service1.stop();

    const service2 = await start({
      ...commonOpts,
      plugins: []
    });

    await Promise.all([
      waitForConsole(page, 'true'),
      page.goto(`${service2.contentServer.local}/main.html`)
    ]);

    await service2.stop();
  });

  test("when a plugin's cache key changes", async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'console.log(_SOME_NUM_)'
      },
    }).apply();
    const commonOpts: ReboostConfig = {
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      includeDefaultPlugins: false,
      log: false,
    }
    const service1 = await start({
      ...commonOpts,
      plugins: [{
        name: 'some-num',
        getCacheKey: () => 'v1',
        transformContent({ code }) {
          return {
            code: code.replace('_SOME_NUM_', '77'),
            map: undefined
          }
        }
      }]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, '77'),
      page.goto(`${service1.contentServer.local}/main.html`)
    ]);

    await service1.stop();

    const service2 = await start({
      ...commonOpts,
      plugins: [{
        name: 'some-num',
        getCacheKey: () => 'v2',
        transformContent({ code }) {
          return {
            code: code.replace('_SOME_NUM_', '100'),
            map: undefined
          }
        }
      }]
    });

    await Promise.all([
      waitForConsole(page, '100'),
      page.goto(`${service2.contentServer.local}/main.html`)
    ]);

    await service2.stop();
  });
});

test('loads cache from disk when cache is available', async () => {
  const fixture = createFixture({
    'main.html': '<script type="module" src="./main.js"></script>',
    'src': {
      'index.js': 'console.log("Works")',
      'dep.txt': ''
    },
  }).apply();
  const options: ReboostConfig = {
    rootDir: fixture.p('.'),
    entries: [['./src/index.js', './main.js']],
    contentServer: { root: '.' },
    includeDefaultPlugins: false,
    log: false,
  }
  const service1 = await start(options);
  const page = await newPage();

  page.setCacheEnabled(false);

  await Promise.all([
    waitForConsole(page, 'Works'),
    page.goto(`${service1.contentServer.local}/main.html`)
  ]);

  await service1.stop();

  const service2 = await start(options);
  
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('index.js')),
    waitForConsole(page, 'Works'),
    page.goto(`${service2.contentServer.local}/main.html`)
  ]);
  expect(response.status()).toBe(200);

  await service2.stop();
});
