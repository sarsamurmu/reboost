import { runTransformation } from 'src-node/core-plugins/commonjs-mode-1';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, 'my-file.js', ''));

describe('transforms CommonJS modules -', () => {
  test('only "exports"', () => {
    expect(t(`
      exports.item1 = 0;
    `)).toMatchSnapshot();

    expect(t(`
      Object.assign(exports, '__esModule', { value: true });
    `)).toMatchSnapshot();
  });

  test('only "module.exports"', () => {
    expect(t(`
      module.exports.item1 = 0;
    `)).toMatchSnapshot('using dot notation');

    expect(t(`
      module['exports'].item1 = 0;
    `)).toMatchSnapshot('using bracket notation');

    expect(t(`
      Object.assign(module.exports, '__esModule', { value: true });
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

  test('if built-in modules are imported using "require"', () => {
    expect(t(`
      const fs = require('fs');
      const path = require('path');
    `)).toMatchSnapshot();
  });
});

describe('transforms ES modules', () => {
  test('which has imports with name', () => {
    expect(t(`
      import Def from 'module_1';
    `)).toMatchSnapshot('default');

    expect(t(`
      import { part1, part2 } from 'module_1';
    `)).toMatchSnapshot('named');

    expect(t(`
      import * as all from 'module_1';
    `)).toMatchSnapshot('all');
  });

  test('which has import just for side effect', () => {
    expect(t(`
      import 'module_1';
    `)).toMatchSnapshot();
  });
});
