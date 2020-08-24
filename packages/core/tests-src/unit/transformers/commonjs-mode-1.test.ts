import { runTransformation } from 'src-node/core-plugins/commonjs-mode-1';
import { createTransformer } from './transformer';

const t = createTransformer((ast) => runTransformation(ast, 'my-file.js', ''));
const match = (code: string) => expect(t(code)).toMatchSnapshot();

describe('transforms CommonJS modules', () => {
  test('only "exports"', () => {
    match(`
      exports.item1 = 0;
    `);
  });

  test('only "module.exports"', () => {
    match(`
      module.exports.item1 = 0;
    `);
  });

  test('both', () => {
    match(`
      module.exports.item1 = 0;
      exports.item2 = 0;
    `);
  });

  test('"require" calls', () => {
    match(`
      const module_1 = require('module_1');
    `);
  });
});

describe('does not transform CommonJS modules', () => {
  test('if "module" is defined', () => {
    match(`
      const module = { exports: {} };
      module.exports.item1 = 0;
    `);
  });

  test('if "exports" is defined', () => {
    match(`
      const exports = {};
      exports.item1 = 0;
    `);
  });

  test('if "require" is defined', () => {
    match(`
      const require = (mod) => someFunc(mod);
      const module_1 = require('module_1');
    `);
  });

  test('if "require" function\'s call signature is different', () => {
    match(`
      const module_1 = require('someThing', 0);
      const result = require(100);
    `);
  });
});

test('transforms ES modules', () => {
  match(`
    import Def from 'module_1';
    import { part1, part2 } from 'module_2';
    import * as all from 'module_3';
  `);
});
