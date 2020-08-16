import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';

export const LoaderPlugin = (): ReboostPlugin => ({
  name: 'core-loader-plugin',
  load(filePath) {
    return {
      code: fs.readFileSync(filePath).toString(),
      type: path.extname(filePath).substring(1)
    }
  }
})
