import fs from 'fs';
import path from 'path';

import { ReboostConfig, ReboostPlugin } from './index';

export const createShared = (config: ReboostConfig, plugins: ReboostPlugin[]) => {
  let filesData: {
    version: string;
    usedPlugins: string;
    mode: string;
    files: Record<string, {
      /** Unique ID of the file */
      uid: string;
      /** Hash of the file */
      hash: string;
      /** Last modified time of the file */
      mtime: number;
      /** Dependencies of the file */
      dependencies?: Record<string, {
        hash: string;
        mtime: number;
      }>;
    }>;
    dependents: Record<string, string[]>;
  };

  const getCurrentVersion = (): string => {
    const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
    return version;
  }

  const getUsedPlugins = () => {
    return plugins
      .filter((p) => p && p.name)
      .map((p) => {
        let id = p.name;
        if (typeof p.getId !== 'undefined') {
          id += '@' + p.getId();
        }
        return id;
      })
      .join(' && ');
  }

  const filesDataPath = () => path.join(config.cacheDir, 'cache_data.json');

  const it = {
    getFilesDir: () => path.join(config.cacheDir, 'files'),

    getFilesData: () => {
      const filePath = filesDataPath();
      if (!filesData) {
        if (fs.existsSync(filePath)) {
          filesData = JSON.parse(fs.readFileSync(filePath).toString());
        } else {
          filesData = {
            version: getCurrentVersion(),
            usedPlugins: getUsedPlugins(),
            mode: config.mode,
            files: {},
            dependents: {}
          };
        }
      }
      return filesData;
    },

    hasPluginsChanged: () => {
      const cachePlugins = it.getFilesData().usedPlugins;
      const currentPlugins = getUsedPlugins();
      return cachePlugins !== currentPlugins;
    },

    saveFilesData: () => {
      if (!filesData) return;

      fs.writeFile(
        filesDataPath(),
        JSON.stringify(filesData, null, config.debugMode ? 2 : 0),
        () => 0
      );
    }
  }

  return it;
}
