import { transformCommonJS } from './transform-commonjs';
import { addCommonJSInterop } from './commonjs-interop';

import { ReboostPlugin } from '../../index';

export const CommonJSMode1Plugin = (): ReboostPlugin => ({
  name: 'core-commonjs-mode-1-plugin', 
  transformAST(ast, a, filePath) {
    transformCommonJS(ast);
    addCommonJSInterop(ast, filePath);
  }
})
