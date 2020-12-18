import { runTransformation } from '<thisPackage>/core-plugins/commonjs-mode-2';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, ''));

describe('fixes <exportsObj>', () => {
  test('when dot notation is used', () => {
    expect(t(`
      module.exports.item1 = 0;
      exports.item2 = 0;
    `)).toMatchSnapshot();
  });

  test('when bracket notation is used', () => {
    expect(t(`
      module.exports['item1'] = 0;
      module['exports'].item2 = 0;
      exports['item3'] = 0;
    `)).toMatchSnapshot();
  });

  test('uses same identifier for same exported name', () => {
    expect(t(`
      module.exports.item1 = 0;
      exports.item1 = 0;
    `)).toMatchSnapshot();
  });
});

describe("does not fix <exportsObj> if <exportsObj>'s variable is already declared", () => {
  test('in the Program scope', () => {
    expect(t(`
      const module = { exports: {} };
      module.exports.item1 = 0;
    `)).toMatchSnapshot();

    expect(t(`
      const exports = {};
      exports.item1 = 0;
    `)).toMatchSnapshot();
  });

  test('in the current scope', () => {
    expect(t(`
      module.exports.item1 = 0;
      {
        const module = { exports: {} };
        module.exports.item2 = 0;
      }
    `)).toMatchSnapshot();

    expect(t(`
      module.exports.item1 = 0;
      callback((module) => {
        module.exports.item2 = 0;
      });
    `)).toMatchSnapshot();

    expect(t(`
      exports.item1 = 0;
      {
        const exports = {};
        exports.item2 = 0;
      }
    `)).toMatchSnapshot();

    expect(t(`
      exports.item1 = 0;
      callback((exports) => {
        exports.item2 = 0;
      });
    `)).toMatchSnapshot();
  });
});

describe('does not export default <exportsObj>', () => {
  test('when default export is available', () => {
    expect(t(`
      module.exports.default = 0;
    `)).toMatchSnapshot();

    expect(t(`
      exports.default = 0;
    `)).toMatchSnapshot();
  });

  describe('when the module is declared __esModule', () => {
    test('using Object.defineProperty', () => {
      expect(t(`
        Object.defineProperty(module.exports, '__esModule', { value: true });
        module.exports.item1 = 0;
      `)).toMatchSnapshot();

      expect(t(`
        Object.defineProperty(exports, '__esModule', { value: true });
        exports.item1 = 0;
      `)).toMatchSnapshot();
    });

    test('using <exportObj>.__esModule', () => {
      expect(t(`
        module.exports.__esModule = true;
        module.exports.item1 = 0;
      `)).toMatchSnapshot();

      expect(t(`
        exports.__esModule = true;
        exports.item1 = 0;
      `)).toMatchSnapshot();
    });
  });
});

test('fixes require calls', () => {
  expect(t(`
    const module_1 = require('module_1');
    const module_1_1 = require('module_1');
  `)).toMatchSnapshot();
});

describe('does not fix require calls', () => {
  test('if call signature is different', () => {
    expect(t(`
      const result_1 = require('someThing', 0);
      const result_2 = require(100);
    `)).toMatchSnapshot();
  });

  test('if it is built-in module', () => {
    expect(t(`
      const fs = require('fs');
      const path = require('path');
    `)).toMatchSnapshot();
  });

  describe('if "require" variable is already declared', () => {
    test('in Program scope', () => {
      expect(t(`
        const require = (mod) => someFunc(mod);
        const module_1 = require('module_1');
      `)).toMatchSnapshot();
    });

    test('in current scope', () => {
      expect(t(`
        const module_1 = require('module_1');
        {
          const require = (mod) => someFunc(mod);
          const result = require('someThing');
        }
      `)).toMatchSnapshot();

      expect(t(`
        const module_1 = require('module_1');
        callback((require) => {
          const result = require('someThing');
        });
      `)).toMatchSnapshot();
    });
  });
});

describe('fixes module.exports = require()', () => {
  test('exports default from the exported module if only one exports is available', () => {
    expect(t(`
      module.exports = require('module_1');
    `)).toMatchSnapshot();
  });

  test('transforms require call when other exports are available after the statement', () => {
    expect(t(`
      module.exports = require('module_1');
      module.exports.item1 = 0;
      exports.item2 = 0;
    `)).toMatchSnapshot();
  });

  test('resets previous exports', () => {
    expect(t(`
      module.exports.item1 = 0;
      exports.item2 = 0;
      module.exports = require('module_1');
    `)).toMatchSnapshot();
  });
});
