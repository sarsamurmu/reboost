import { ReboostPlugin } from '../../index';
import { transformCommonJSToES6 } from './commonjs-to-es6';

export const CommonJSMode2Plugin = (): ReboostPlugin => ({
  name: 'core-commonjs-mode-2-plugin',
  transformAST(ast) {
    transformCommonJSToES6(ast);
  }
});
