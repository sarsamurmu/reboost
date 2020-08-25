import { runTransformation } from 'src-node/core-plugins/commonjs-mode-1';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, 'my-file.js', ''));

describe('transforms CommonJS modules', () => {
  test('only "exports"', () => {
    expect(t(`
      exports.item1 = 0;
    `)).toMatchSnapshot();
  });

  test('only "module.exports"', () => {
    expect(t(`
      module.exports.item1 = 0;
    `)).toMatchSnapshot();
  });

  test('both', () => {
    expect(t(`
      module.exports.item1 = 0;
      exports.item2 = 0;
    `)).toMatchSnapshot();
  });

  test('"require" calls', () => {
    expect(t(`
      const module_1 = require('module_1');
    `)).toMatchSnapshot();
  });
});

describe('does not transform CommonJS modules', () => {
  test('if "module" is defined', () => {
    expect(t(`
      const module = { exports: {} };
      module.exports.item1 = 0;
    `)).toMatchSnapshot();
  });

  test('if "exports" is defined', () => {
    expect(t(`
      const exports = {};
      exports.item1 = 0;
    `)).toMatchSnapshot();
  });

  test('if "require" is defined', () => {
    expect(t(`
      const require = (mod) => someFunc(mod);
      const module_1 = require('module_1');
    `)).toMatchSnapshot();
  });

  test('if "require" function\'s call signature is different', () => {
    expect(t(`
      const module_1 = require('someThing', 0);
      const result = require(100);
    `)).toMatchSnapshot();
  });
});

test('transforms ES modules', () => {
  expect(t(`
    import Def from 'module_1';
    import { part1, part2 } from 'module_2';
    import * as all from 'module_3';
  `)).toMatchSnapshot();
});
