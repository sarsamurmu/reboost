import fs from 'fs';

import { start } from 'src-node/index';

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
      log: false
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, 'Works'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);

    fs.writeFileSync(fixture.p('./src/index.js'), 'console.log("Updated")');

    await Promise.all([
      waitForConsole(page, 'Updated'),
      page.reload()
    ]);

    await service.stop();
  });

  test.todo('when dependency changes');
});
