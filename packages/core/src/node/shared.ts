import fs from 'fs';
import path from 'path';

import { ReboostConfig, DefaultConfig } from './index';

let address: string;
let config = DefaultConfig as ReboostConfig;
let filesData: {
  version: string;
  usedPlugins: string;
  files: Record<string, {
    /** Unique ID of the file */
    uid: string;
    /** Hash of the file */
    hash: string;
    /** Last modified time of the file */
    mtime: number;
    /** Only if file has no imports */
    pure: boolean;
    /** Address used in the file */
    address: string;
    /** Dependencies of the file */
    dependencies?: Record<string, {
      hash: string;
      mtime: number;
    }>;
  }>;
  dependents: Record<string, string[]>;
};

export const getAddress = () => address;
export const setAddress = (aAddress: string) => address = aAddress;

export const getConfig = () => config;
export const setConfig = (aConfig: ReboostConfig) => config = aConfig;

export const getFilesDir = () => path.join(getConfig().cacheDir, 'files');

export const getVersion = (): string => {
  const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
  return version;
}

export const getUsedPlugins = () => {
  return getConfig().plugins
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

const filesDataPath = () => path.join(getConfig().cacheDir, 'cache_data.json');
export const getFilesData = () => {
  const filePath = filesDataPath();
  if (!filesData) {
    if (fs.existsSync(filePath)) {
      filesData = JSON.parse(fs.readFileSync(filePath).toString());
    } else {
      filesData = {
        version: getVersion(),
        usedPlugins: getUsedPlugins(),
        files: {},
        dependents: {}
      };
    }
  }
  return filesData;
}

export const saveFilesData = () => {
  if (filesData) {
    fs.promises.writeFile(filesDataPath(), JSON.stringify(filesData, null, getConfig().debugMode ? 2 : 0));
  }
}
