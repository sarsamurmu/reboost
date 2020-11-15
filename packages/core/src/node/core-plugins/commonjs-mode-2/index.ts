import anymatch from 'anymatch';

import { ReboostInstance, ReboostPlugin } from '../../index';
import { transformCommonJSToES6 } from './commonjs-to-es6';
import { uniqueID } from '../../utils';

export { transformCommonJSToES6 as runTransformation }

export const CommonJSMode2Plugin = (instance: ReboostInstance): ReboostPlugin => {
  const test = (file: string) => (
    !anymatch(instance.config.commonJSInterop.exclude, file) &&
    anymatch(instance.config.commonJSInterop.include, file)
  );

  return {
    name: 'core-commonjs-mode-2-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject({
      include: instance.config.commonJSInterop.include,
      exclude: instance.config.commonJSInterop.exclude
    }),
    transformAST(ast, _, filePath) {
      if (test(filePath)) {
        transformCommonJSToES6(ast, uniqueID(6));
      }
    }
  }
}
