import fs from 'fs';

import { ReboostPlugin } from '../../index';

export const LoaderPlugin: ReboostPlugin = {
  load(filePath) {
    return {
      code: fs.readFileSync(filePath).toString()
    }
  }
}
