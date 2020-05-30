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
    /** Hash of the file */
    hash: string;
    /** Address used in the file */
    address: string;
    /** Dependencies of the file */
    dependencies: string[];
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
