import { start } from '<thisPackage>';

import { newPage, waitForConsole } from '../../helpers/browser';
import { createFixture } from '../../helpers/fixture';

test('serves script', async () => {
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

  await Promise.all([
    waitForConsole(page, 'Works'),
    page.goto(`${service.contentServer.local}/main.html`)
  ]);

  await service.stop();
});

test('supports imports', async () => {
  const fixture = createFixture({
    'main.html': '<script type="module" src="./main.js"></script>',
    'src': {
      'index.js': 'import "./imported.js"',
      'imported.js': 'console.log("Works")'
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [['./src/index.js', './main.js']],
    contentServer: { root: '.' },
    includeDefaultPlugins: false,
    log: false
  });
  const page = await newPage();

  await Promise.all([
    waitForConsole(page, 'Works'),
    page.goto(`${service.contentServer.local}/main.html`)
  ]);

  await service.stop();
});
