import { getPage, createFixture } from './helpers';

import { start } from 'src-node/index';

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
          div.id = 'main';
          div.innerText = 'Page is working';
          document.body.appendChild(div);
        }
      `
    }
  }).apply();

  test('content server works', async () => {
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [[
        './src/index.js', './public/dist/index.js'
      ]],
      contentServer: {
        root: './public'
      }
    });

    const page = await getPage();

    await page.goto(service.contentServer.local);
    expect(await page.$eval('#main', (el) => el.innerHTML)).toMatch('Page is working');

    await service.stop();
    fixture.rollback();
  });
});
