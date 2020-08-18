import anymatch from 'anymatch';

import { ReboostPlugin } from '../../index';
import { transformCommonJSToES6 } from './commonjs-to-es6';
import { getConfig } from '../../shared';

export const CommonJSMode2Plugin = (): ReboostPlugin => {
  const test = (file: string) => (
    !anymatch(getConfig().commonJSInterop.exclude, file) &&
    anymatch(getConfig().commonJSInterop.include, file)
  );

  return {
    name: 'core-commonjs-mode-2-plugin',
    transformAST(ast, _, filePath) {
      if (test(filePath)) {
        transformCommonJSToES6(ast);
      }
    }
  }
}
