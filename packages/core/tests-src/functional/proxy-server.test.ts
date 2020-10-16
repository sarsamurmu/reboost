import fs from 'fs';

import { start, ReboostPlugin } from 'src-node/index';

import { newPage, waitForConsole } from '../helpers/browser';
import { createFixture } from '../helpers/fixture';

jest.setTimeout(15000);

test('serves script', async () => {
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
    log: false
  });
  const page = await newPage();

  await Promise.all([
    waitForConsole(page, 'Works'),
    page.goto(`${service.contentServer.local}/main.html`)
  ]);

  await service.stop();
});

describe('plugins', () => {
  test('setup hook', async () => {
    const mockFn = jest.fn();
    const service = await start({
      rootDir: createFixture({}).apply().p('.'),
      entries: [],
      log: false,
      plugins: [
        { name: '1', setup: mockFn },
        { name: '2', setup: mockFn }
      ]
    });

    expect(mockFn).toBeCalledTimes(2);

    await service.stop();
  });

  test('stop hook', async () => {
    const mockFn = jest.fn();
    const service = await start({
      rootDir: createFixture({}).apply().p('.'),
      entries: [],
      log: false,
      plugins: [
        { name: '1', stop: mockFn },
        { name: '2', stop: mockFn }
      ]
    });

    await service.stop();

    expect(mockFn).toBeCalledTimes(2);
  });

  test('resolve hook', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "to-resolve"; import "./log.js"',
        'log.js': 'console.log("From log.js")',
        'resolved-file.js': 'console.log("From resolved-file.js")'
      }
    }).apply();
    type resFnT = ReboostPlugin['resolve'];
    const resolveFn = jest.fn<ReturnType<resFnT>, Parameters<resFnT>>((pathToResolve, relativeTo) => {
      if (pathToResolve === 'to-resolve' && relativeTo === fixture.p('./src/index.js')) {
        return fixture.p('./src/resolved-file.js');
      }
    });
    const mockFn2 = jest.fn();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [
        { name: 'my-resolver', resolve: resolveFn },
        { name: 'mocked', resolve: mockFn2 }
      ]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, 'From log.js'),
      waitForConsole(page, 'From resolved-file.js'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(resolveFn).toBeCalledTimes(2);
    expect(mockFn2).toBeCalledTimes(1);

    await service.stop();
  });

  test('load hook', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./log.js"',
        'log.js': 'console.log("From log.js")',
      }
    }).apply();
    type loadFnT = ReboostPlugin['load'];
    const loadFn = jest.fn<ReturnType<loadFnT>, Parameters<loadFnT>>((filePath) => {
      if (filePath === fixture.p('./src/log.js')) {
        return {
          code: 'console.log("Modified by the loader")',
          type: 'js'
        }
      }
    });
    const mockFn2 = jest.fn();
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [
        { name: 'my-loader', load: loadFn },
        { name: 'mocked', load: mockFn2 }
      ]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, 'Modified by the loader'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(loadFn).toBeCalledTimes(2);
    expect(loadFn.mock.results[0].value).toBeUndefined();
    expect(loadFn.mock.results[1].value).toEqual({
      code: 'console.log("Modified by the loader")',
      type: 'js'
    });
    expect(mockFn2).toBeCalledTimes(1);
    expect(mockFn2.mock.results[0].value).toBeUndefined();

    await service.stop();
  });

  describe('transformContent hook', () => {
    test('without error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./log.js"',
          'log.js': '',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformContent'];
      const transformFn1 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return {
            code: 'From transformer 1',
            type: 'plain',
            map: undefined
          }
        }
      });
      const transformFn2 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return {
            code: 'console.log("By transformer 2")',
            type: 'js',
            map: undefined
          }
        }
      });
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformContent: transformFn1 },
          { name: '2', transformContent: transformFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, 'By transformer 2'),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn1).toBeCalledTimes(2);
      expect(transformFn1.mock.results[0].value).toBeUndefined();
      expect(transformFn1.mock.results[1].value).toEqual({
        code: 'From transformer 1',
        type: 'plain',
        map: undefined
      });
      expect(transformFn2).toBeCalledTimes(2);
      expect(transformFn2.mock.results[0].value).toBeUndefined();
      expect(transformFn2.mock.calls[1]).toEqual([
        {
          code: 'From transformer 1',
          type: 'plain',
          map: undefined
        },
        fixture.p('./src/log.js')
      ]);
      expect(transformFn2.mock.results[1].value).toEqual({
        code: 'console.log("By transformer 2")',
        type: 'js',
        map: undefined
      });

      await service.stop();
    });

    test('with error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./log.js"',
          'log.js': '',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformContent'];
      const transformFn1 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return new Error('Error from transformer 1');
        }
      });
      const transformFn2 = jest.fn();
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformContent: transformFn1 },
          { name: '2', transformContent: transformFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, (msg) => {
          if (msg.text().includes('Error from transformer 1')) {
            expect(msg.type()).toBe('error');
            return true;
          }
        }),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn1).toBeCalledTimes(2);
      expect(transformFn1.mock.results[0].value).toBeUndefined();
      expect(transformFn1.mock.results[1].value).toBeInstanceOf(Error);
      expect(transformFn1.mock.results[1].value).toEqual(expect.objectContaining({
        message: 'Error from transformer 1'
      }));
      expect(transformFn2).toBeCalledTimes(1);
      expect(transformFn1.mock.results[0].value).toBeUndefined();

      await service.stop();
    });
  });

  describe('transformIntoJS hook', () => {
    test('without error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./plain.txt"',
          'plain.txt': 'A plain text',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformIntoJS'];
      const transformFn = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>(({ code, type }) => {
        if (type === 'txt') {
          return {
            code: `console.log(${JSON.stringify(code)})`,
          }
        }
      });
      const mockFn2 = jest.fn();
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformIntoJS: transformFn },
          { name: '2', transformIntoJS: mockFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, 'A plain text'),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn).toBeCalledTimes(1);
      expect(transformFn.mock.results[0].value).toEqual({
        code: 'console.log("A plain text")'
      });
      expect(mockFn2).toBeCalledTimes(0);

      await service.stop();
    });

    test('with error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./plain.txt"',
          'plain.txt': 'A plain text',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformIntoJS'];
      const transformFn = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>(({ type }) => {
        if (type === 'txt') {
          return new Error('Error from the transformer');
        }
      });
      const mockFn2 = jest.fn();
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformIntoJS: transformFn },
          { name: '2', transformIntoJS: mockFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, (msg) => {
          if (msg.text().includes('Error from the transformer')) {
            expect(msg.type()).toBe('error');
            return true;
          }
        }),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn).toBeCalledTimes(1);
      expect(transformFn.mock.results[0].value).toBeInstanceOf(Error);
      expect(transformFn.mock.results[0].value).toEqual(expect.objectContaining({
        message: 'Error from the transformer'
      }));
      expect(mockFn2).toBeCalledTimes(0);

      await service.stop();
    });
  });

  describe('transformJSContent hook', () => {
    test('without error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./log.js"',
          'log.js': '',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformJSContent'];
      const transformFn1 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return {
            code: 'From transformer 1',
            map: undefined
          }
        }
      });
      const transformFn2 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return {
            code: 'console.log("By transformer 2")',
            map: undefined
          }
        }
      });
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformJSContent: transformFn1 },
          { name: '2', transformJSContent: transformFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, 'By transformer 2'),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn1).toBeCalledTimes(2);
      expect(transformFn1.mock.results[0].value).toBeUndefined();
      expect(transformFn1.mock.results[1].value).toEqual({
        code: 'From transformer 1',
        map: undefined
      });
      expect(transformFn2).toBeCalledTimes(2);
      expect(transformFn2.mock.results[0].value).toBeUndefined();
      expect(transformFn2.mock.calls[1]).toEqual([
        {
          code: 'From transformer 1',
          type: 'js',
          map: expect.anything()
        },
        fixture.p('./src/log.js')
      ]);
      expect(transformFn2.mock.results[1].value).toEqual({
        code: 'console.log("By transformer 2")',
        map: undefined
      });

      await service.stop();
    });

    test('with error', async () => {
      const fixture = createFixture({
        'main.html': '<script type="module" src="./main.js"></script>',
        'src': {
          'index.js': 'import "./log.js"',
          'log.js': '',
        }
      }).apply();
      type transformFnT = ReboostPlugin['transformJSContent'];
      const transformFn1 = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((_, filePath) => {
        if (filePath === fixture.p('./src/log.js')) {
          return new Error('Error from transformer 1');
        }
      });
      const transformFn2 = jest.fn();
      const service = await start({
        rootDir: fixture.p('.'),
        entries: [['./src/index.js', './main.js']],
        contentServer: { root: '.' },
        log: false,
        plugins: [
          { name: '1', transformJSContent: transformFn1 },
          { name: '2', transformJSContent: transformFn2 }
        ]
      });
      const page = await newPage();

      await Promise.all([
        waitForConsole(page, (msg) => {
          if (msg.text().includes('Error from transformer 1')) {
            expect(msg.type()).toBe('error');
            return true;
          }
        }),
        page.goto(`${service.contentServer.local}/main.html`)
      ]);
      expect(transformFn1).toBeCalledTimes(2);
      expect(transformFn1.mock.results[0].value).toBeUndefined();
      expect(transformFn1.mock.results[1].value).toBeInstanceOf(Error);
      expect(transformFn1.mock.results[1].value).toEqual(expect.objectContaining({
        message: 'Error from transformer 1'
      }));
      expect(transformFn2).toBeCalledTimes(1);
      expect(transformFn1.mock.results[0].value).toBeUndefined();

      await service.stop();
    });
  });

  test('transformAST hook', async () => {
    const fixture = createFixture({
      'main.html': '<script type="module" src="./main.js"></script>',
      'src': {
        'index.js': 'import "./log.js"',
        'log.js': 'console.log("123456")',
      }
    }).apply();
    type transformFnT = ReboostPlugin['transformAST'];
    const transformFn = jest.fn<ReturnType<transformFnT>, Parameters<transformFnT>>((ast, { traverse }, filePath) => {
      if (filePath === fixture.p('./src/log.js')) {
        traverse(ast, {
          StringLiteral(path) {
            path.node.value = path.node.value.split('').reverse().join('');
          }
        });
      }
    });
    const service = await start({
      rootDir: fixture.p('.'),
      entries: [['./src/index.js', './main.js']],
      contentServer: { root: '.' },
      log: false,
      plugins: [
        { name: '1', transformAST: transformFn }
      ]
    });
    const page = await newPage();

    await Promise.all([
      waitForConsole(page, '654321'),
      page.goto(`${service.contentServer.local}/main.html`)
    ]);
    expect(transformFn).toBeCalledTimes(2);

    await service.stop();
  });
});

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
