import { ReboostPlugin } from '../index';

export const FilePlugin = (): ReboostPlugin => ({
  name: 'core-file-plugin',
  load(filePath) {
    return {
      code: `export default '${this.address}/raw?q=${encodeURI(filePath)}'`,
      type: 'js'
    }
  }
})
