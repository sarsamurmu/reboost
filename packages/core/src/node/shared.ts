import fs from 'fs';
import path from 'path';

import { ReboostConfig, DefaultConfig, ReboostPlugin } from './index';

let address: string;
let config = DefaultConfig as ReboostConfig;
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
const serviceStoppers: [() => Promise<void> | void, string][] = [];

export const addServiceStopper = (label: string, cb: () => Promise<void> | void) => {
  serviceStoppers.push([cb, label]);
}
export const getServiceStoppers = () => serviceStoppers;

export const getAddress = () => address;
export const setAddress = (aAddress: string) => address = aAddress;

export const getConfig = () => config;
export const getPlugins = () => config.plugins as ReboostPlugin[];
export const setConfig = (aConfig: ReboostConfig) => config = aConfig;

export const getFilesDir = () => path.join(getConfig().cacheDir, 'files');

export const getVersion = (): string => {
  const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
  return version;
}

export const getUsedPlugins = () => {
  return getPlugins()
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
        mode: getConfig().mode,
        files: {},
        dependents: {}
      };
    }
  }
  return filesData;
}

export const saveFilesData = () => {
  if (!filesData) return;
  
  fs.writeFile(
    filesDataPath(),
    JSON.stringify(filesData, null, getConfig().debugMode ? 2 : 0),
    () => 0
  );
}
