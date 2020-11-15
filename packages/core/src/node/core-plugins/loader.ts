import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';

export const LoaderPlugin = (): ReboostPlugin => ({
  name: 'core-loader-plugin',
  getCacheKey: () => 1,
  load: (filePath) => ({
    code: fs.readFileSync(filePath).toString(),
    type: path.extname(filePath).substring(1)
  })
})
