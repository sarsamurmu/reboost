import { transformCommonJS } from './transform-commonjs';

import { ReboostPlugin } from '../../index';
import { uniqueID } from '../../utils';

export { transformCommonJS as runTransformation }

export const CommonJSMode1Plugin = (): ReboostPlugin => ({
  name: 'core-commonjs-mode-1-plugin',
  getCacheKey: () => 1,
  transformAST(ast, _, filePath) {
    transformCommonJS(ast, filePath, uniqueID(6));
  }
})
