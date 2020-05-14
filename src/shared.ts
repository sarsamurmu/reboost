import { ReboostConfig } from './index';
import fs from 'fs';
import path from 'path';
import { Context } from 'koa';

let address: string;
let config: ReboostConfig;
let filesData: {
  version: number;
  files: Record<string, {
    /** Unique ID of the file */
    uid: string;
    /** If the file is pure. File is pure if it has no dependency or source map */
    pure?: boolean;
    hash: string;
    address: string;
  }>;
  dependents: Record<string, string[]>;
};
let webSocket: Context['websocket'];

export const getAddress = () => address;
export const setAddress = (aAddress: string) => address = aAddress;

export const getConfig = () => config;
export const setConfig = (aConfig: ReboostConfig) => config = aConfig;

export const getFilesDir = () => path.join(getConfig().cacheDir, 'files');

const filesDataPath = () => path.join(getConfig().cacheDir, 'files_data.json');
export const getFilesData = () => {
  const filePath = filesDataPath();
  if (!filesData) {
    if (fs.existsSync(filePath)) {
      filesData = JSON.parse(fs.readFileSync(filePath).toString());
    } else {
      const pkgJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json')).toString());
      filesData = {
        version: parseInt(pkgJSON.version.replace(/\./g, '')),
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
