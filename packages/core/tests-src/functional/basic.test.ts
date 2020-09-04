import { start } from 'src-node/index';

import { createFixture } from '../helpers/fixture';
import { newPage, waitForConsole } from '../helpers/browser';

jest.setTimeout(15000);

test('basic thing', async () => {
  const fixture = createFixture({
    'public': {
      'index.html': /* html */`
        <html>
          <script type="module" src="./dist/index.js"></script>
        </html>
      `
    },
    'src': {
      'index.js': /* js */`
        import { fun } from './imported.js';
        fun();
      `,
      'imported.js': /* js */`
        export const fun = () => console.log('works');
      `
    }
  }).apply();
  const service = await start({
    rootDir: fixture.p('.'),
    entries: [
      ['./src/index.js', './public/dist/index.js']
    ],
    contentServer: {
      root: './public'
    },
    log: false
  });
  const page = await newPage();

  await Promise.all([
    waitForConsole(page, 'works'),
    page.goto(`${service.contentServer.local}/index.html`)
  ]);

  await service.stop();
});
