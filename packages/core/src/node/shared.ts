import { Context } from 'koa';

import fs from 'fs';
import path from 'path';

import { ReboostConfig } from './index';

let address: string;
let config: ReboostConfig;
let filesData: {
  version: number;
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
let webSocket: Context['websocket'];

export const getAddress = () => address;
export const setAddress = (aAddress: string) => address = aAddress;

export const getConfig = () => config;
export const setConfig = (aConfig: ReboostConfig) => config = aConfig;

export const getFilesDir = () => path.join(getConfig().cacheDir, 'files');

export const getVersion = () => {
  const pkgJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
  return parseInt(pkgJSON.version.replace(/\./g, ''));
}

const filesDataPath = () => path.join(getConfig().cacheDir, 'files_data.json');
export const getFilesData = () => {
  const filePath = filesDataPath();
  if (!filesData) {
    if (fs.existsSync(filePath)) {
      filesData = JSON.parse(fs.readFileSync(filePath).toString());
    } else {
      filesData = {
        version: getVersion(),
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

export const setWebSocket = (aWebSocket: any) => webSocket = aWebSocket;
export const messageClient = (message: any) => webSocket && webSocket.send(JSON.stringify(message));
