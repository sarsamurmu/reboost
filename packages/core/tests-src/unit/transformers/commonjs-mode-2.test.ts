import { runTransformation } from 'src-node/core-plugins/commonjs-mode-2';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, ''));
const match = (code: string) => expect(t(code)).toMatchSnapshot();

describe('fixes <exportsObj>', () => {
  test('when dot notation is used', () => {
    match(`
      module.exports.item1 = 0;
      exports.item2 = 0;
    `);
  });

  test('when bracket notation is used', () => {
    match(`
      module.exports['item1'] = 0;
      module['exports'].item2 = 0;
      exports['item3'] = 0;
    `);
  });

  test('uses same identifier for same exported name', () => {
    match(`
      module.exports.item1 = 0;
      exports.item1 = 0;
    `);
  });
});

describe("does not fix <exportsObj> if <exportsObj>'s variable is already declared", () => {
  test('in the Program scope', () => {
    match(`
      const module = { exports: {} };
      module.exports.item1 = 0;
    `);

    match(`
      const exports = {};
      exports.item1 = 0;
    `);
  });

  test('in the current scope', () => {
    match(`
      module.exports.item1 = 0;
      {
        const module = { exports: {} };
        module.exports.item2 = 0;
      }
    `);

    match(`
      module.exports.item1 = 0;
      callback((module) => {
        module.exports.item2 = 0;
      });
    `);

    match(`
      exports.item1 = 0;
      {
        const exports = {};
        exports.item2 = 0;
      }
    `);

    match(`
      exports.item1 = 0;
      callback((exports) => {
        exports.item2 = 0;
      });
    `);
  });
});

describe('does not export default <exportsObj>', () => {
  test('when default export is available', () => {
    match(`
      module.exports.default = 0;
    `);

    match(`
      exports.default = 0;
    `);
  });

  describe('when the module is declared __esModule', () => {
    test('using Object.defineProperty', () => {
      match(`
        Object.defineProperty(module.exports, '__esModule', { value: true });
        module.exports.item1 = 0;
      `);

      match(`
        Object.defineProperty(exports, '__esModule', { value: true });
        exports.item1 = 0;
      `);
    });

    test('using <exportObj>.__esModule', () => {
      match(`
        module.exports.__esModule = true;
        module.exports.item1 = 0;
      `);

      match(`
        exports.__esModule = true;
        exports.item1 = 0;
      `);
    });
  });
});

test('fixes require calls', () => {
  match(`
    const module_1 = require('module_1');
    const module_1_1 = require('module_1');
  `);
});

describe('does not fix require calls', () => {
  test('if call signature is different', () => {
    match(`
      const result_1 = require('someThing', 0);
      const result_2 = require(100);
    `);
  });

  test('if it is built-in module', () => {
    match(`
      const fs = require('fs');
      const path = require('path');
    `);
  });

  describe('if "require" variable is already declared', () => {
    test('in Program scope', () => {
      match(`
        const require = (mod) => someFunc(mod);
        const module_1 = require('module_1');
      `);
    });

    test('in current scope', () => {
      match(`
        const module_1 = require('module_1');
        {
          const require = (mod) => someFunc(mod);
          const result = require('someThing');
        }
      `);

      match(`
        const module_1 = require('module_1');
        callback((require) => {
          const result = require('someThing');
        });
      `);
    });
  });
});

describe('fixes module.exports = require()', () => {
  test('exports default from the exported module if only one exports is available', () => {
    match(`
      module.exports = require('module_1');
    `);
  });

  test('transforms require call when other exports are available after the statement', () => {
    match(`
      module.exports = require('module_1');
      module.exports.item1 = 0;
      exports.item2 = 0;
    `);
  });

  test('resets previous exports', () => {
    match(`
      module.exports.item1 = 0;
      exports.item2 = 0;
      module.exports = require('module_1');
    `);
  });
});
