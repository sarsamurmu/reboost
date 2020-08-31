import { ReboostPlugin } from '../index';

export const FilePlugin = (): ReboostPlugin => ({
  name: 'core-file-plugin',
  transformIntoJS(_, filePath) {
    return {
      code: `
        const serverAddress = new URL(import.meta.absoluteUrl).origin;
        const fileUrl = new URL('/raw?q=${encodeURI(filePath)}', serverAddress);
        export default fileUrl;
      `
    }
  }
})
