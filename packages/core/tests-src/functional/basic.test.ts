import { start } from 'src-node/index';

import { createFixture } from '../helpers/fixture';
import { newPage } from '../helpers/browser';

jest.setTimeout(15000);

describe('does basic things', () => {
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
        import { render } from './renderer.js';

        render();
      `,
      'renderer.js': /* js */`
        export const render = () => {
          const div = document.createElement('div');
          div.innerText = 'Page is working';
          document.body.appendChild(div);
        }
      `
    }
  }).apply();

  test('basic thing', async () => {
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

    await page.goto(
      new URL('index.html', service.contentServer.local).toString(),
    );
    expect(await page.$eval('body', (el: HTMLElement) => el.innerText)).toMatch('Page is working');

    await service.stop();
  });
});
