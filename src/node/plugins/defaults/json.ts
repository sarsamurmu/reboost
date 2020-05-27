import MagicString from 'magic-string';

import { ReboostPlugin } from '../../index';

export const JSONPlugin: ReboostPlugin = {
  name: 'core-json-plugin',
  transformIntoJS(data) {
    if (data.type === 'json') {
      const jsonString = data.code;
      const magicString = new MagicString(jsonString);
      magicString.prepend('export default ');

      return {
        code: magicString.toString(),
        inputMap: magicString.generateMap().toString()
      }
    }

    return null;
  }
}
