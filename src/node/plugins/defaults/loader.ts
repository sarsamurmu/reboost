import fs from 'fs';

import { ReboostPlugin } from '../../index';

export const LoaderPlugin: ReboostPlugin = {
  name: 'core-loader-plugin',
  load(filePath) {
    return {
      code: fs.readFileSync(filePath).toString()
    }
  }
}
