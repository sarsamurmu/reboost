import { ReboostPlugin } from '../index';

export const FilePlugin = (): ReboostPlugin => ({
  name: 'core-file-plugin',
  getCacheKey: () => 1,
  transformIntoJS: (_, filePath) => ({
    code: `
      const serverAddress = new URL(import.meta.absoluteUrl).origin;
      const fileUrl = new URL('/raw?q=${encodeURIComponent(filePath)}', serverAddress);
      export default fileUrl;
    `
  })
})
