import { ReboostPlugin } from '../../index';

export const JSONPlugin: ReboostPlugin = {
  name: 'core-json-plugin',
  transformIntoJS(data, filePath) {
    if (data.type === 'json') {
      const jsonString = data.code;
      const magicString = new this.MagicString(jsonString);
      magicString.prepend('export default ');

      const inputMap = magicString.generateMap();
      inputMap.sources = [filePath];

      return {
        code: magicString.toString(),
        inputMap
      }
    }

    return null;
  }
}
