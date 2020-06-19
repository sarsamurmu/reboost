import { ReboostPlugin } from '../index';

export const FilePlugin = (): ReboostPlugin => ({
  name: 'core-file-plugin',
  transformIntoJS(_, filePath) {
    return {
      code: `export default '${this.address}/raw?q=${encodeURI(filePath)}'`
    }
  }
})
