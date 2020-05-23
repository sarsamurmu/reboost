import MagicString from 'magic-string';

import fs from 'fs';

import { ReboostPlugin } from '../../index';

export const JSONLoaderPlugin: ReboostPlugin = {
  name: 'core-json-loader-plugin',
  load(filePath) {
    if (filePath.match(/\.json$/)) {
      const jsonString = fs.readFileSync(filePath).toString();
      const magicString = new MagicString(jsonString);
      magicString.prepend('export default ');

      return {
        code: magicString.toString(),
        original: jsonString,
        map: magicString.generateMap().toString()
      }
    }

    return null;
  }
}
