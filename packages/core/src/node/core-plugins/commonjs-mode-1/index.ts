import { transformCommonJS } from './transform-commonjs';
import { addCommonJSInterop } from './commonjs-interop';

import { ReboostPlugin } from '../../index';
import { uniqueID } from '../../utils';

export const runTransformation = (ast: any, filePath: string, uid: string) => {
  transformCommonJS(ast, uid);
  addCommonJSInterop(ast, filePath);
}

export const CommonJSMode1Plugin = (): ReboostPlugin => ({
  name: 'core-commonjs-mode-1-plugin', 
  transformAST(ast, _, filePath) {
    transformCommonJS(ast, uniqueID(6));
    addCommonJSInterop(ast, filePath);
  }
})
