import { transformCommonJS } from './transform-commonjs';

import { ReboostPlugin } from '../../index';
import { uniqueID } from '../../utils';

export { transformCommonJS as runTransformation }

export const CommonJSMode1Plugin = (): ReboostPlugin => ({
  name: 'core-commonjs-mode-1-plugin',
  getCacheKey: () => 1,
  transformAST(programPath, _, filePath) {
    transformCommonJS(programPath, filePath, uniqueID(6));
  }
})
