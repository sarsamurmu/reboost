import { ParameterizedContext } from 'koa';
import { RouterParamContext } from '@koa/router';
import hash from 'md5-file';
import anymatch from 'anymatch';
import { FSWatcher } from 'chokidar';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, getAddress, saveFilesData, getFilesDir, messageClient } from './shared';
import { ensureDir, uniqueID } from './utils';
import { transformFile } from './transform';

const removeDeletedFile = (filePath: string) => {
  const filesData = getFilesData();
  const fileData = filesData.files[filePath];
  if (fileData) {
    filesData.files[filePath] = undefined;
    const absoluteFilePath = path.join(getFilesDir(), fileData.uid);
    fs.unlinkSync(absoluteFilePath);
    if (fs.existsSync(absoluteFilePath + '.map')) {
      fs.unlinkSync(absoluteFilePath + '.map');
    }
    const dependents = filesData.dependents[filePath];
    if (dependents) {
      filesData.dependents[filePath] = undefined;
      dependents.forEach((dependent) => removeDeletedFile(dependent));
    }
  }
}

export const verifyFiles = () => {
  if (fs.existsSync(getFilesDir())) {
    const filesData = getFilesData();
    for (const filePath in filesData.files) {
      if (!fs.existsSync(filePath)) removeDeletedFile(filePath);
    }
  }
  saveFilesData();
}

let gitignoreCreated = false;

const watcher = new FSWatcher();
watcher.on('change', (filePath) => {
  messageClient(filePath);
});
watcher.on('unlink', (filePath) => {
  removeDeletedFile(filePath);
  // TODO: Message client that the file is deleted
});
const watchedFiles = new Set<string>();
const watchFile = (filePath: string) => {
  if (watchedFiles.has(filePath)) return;
  watcher.add(filePath);
  watchedFiles.add(filePath);
}

export const fileRequestHandler = async (ctx: ParameterizedContext<any, RouterParamContext<any, {}>>) => {
  const config = getConfig();
  const filesDir = getFilesDir();
  ensureDir(config.cacheDir);
  ensureDir(filesDir);
  if (!gitignoreCreated) {
    fs.writeFileSync(path.join(config.cacheDir, './.gitignore'), '/**/*');
    gitignoreCreated = true;
  }

  const filePath = ctx.query.q;
  if (filePath === 'null') return;
  const fileHash = await hash(filePath);
  let transformedCode: string;

  const addToDependents = (dependencies: string[]) => {
    dependencies.forEach((dependency) => {
      let dependents = getFilesData().dependents[dependency];
      if (!dependents) dependents = getFilesData().dependents[dependency] = [];
      if (!dependents.includes(filePath)) dependents.push(filePath);
    });
  }

  if (getFilesData().files[filePath]) {
    const fileData = getFilesData().files[filePath];
    const outputFilePath = path.join(filesDir, fileData.uid);

    if (fileData.hash !== fileHash) {
      let pure = true;
      const { code, dependencies, map } = await transformFile(filePath);
      transformedCode = code;
      if (map) {
        // Remove other source maps
        transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
        transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
        fs.promises.writeFile(`${outputFilePath}.map`, map);
      }
      fs.promises.writeFile(outputFilePath, transformedCode);
      if (map || dependencies.length) pure = undefined;
      fileData.hash = fileHash;
      fileData.address = getAddress();
      fileData.pure = pure;
      addToDependents(dependencies);
      saveFilesData();
    } else {
      const currentAddress = getAddress();
      transformedCode = fs.readFileSync(outputFilePath).toString();
      if (!fileData.pure && (fileData.address !== currentAddress)) {
        const addressRegex = new RegExp(fileData.address, 'g');
        transformedCode = transformedCode.replace(addressRegex, currentAddress);
        fs.promises.writeFile(outputFilePath, transformedCode);
        if (fs.existsSync(`${outputFilePath}.map`)) {
          const fileMap = fs.readFileSync(`${outputFilePath}.map`).toString();
          fs.promises.writeFile(`${outputFilePath}.map`, fileMap.replace(addressRegex, currentAddress));
        }
        fileData.address = currentAddress;
        saveFilesData();
      }
    }
  } else {
    let pure = true;
    const uid = uniqueID();
    const outputFilePath = path.join(filesDir, uid);
    const { code, dependencies, map } = await transformFile(filePath);
    transformedCode = code;
    if (map) {
      // Remove other source maps
      transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
      transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
      fs.promises.writeFile(`${outputFilePath}.map`, map);
    }
    fs.promises.writeFile(outputFilePath, transformedCode);
    if (map || dependencies.length) pure = undefined;
    getFilesData().files[filePath] = {
      uid,
      pure,
      hash: fileHash,
      address: getAddress()
    }
    addToDependents(dependencies);
    saveFilesData();
  }

  if (
    !anymatch(config.watchOptions.exclude, filePath) && // Not excluded
    anymatch(config.watchOptions.include, filePath) // and included
  ) watchFile(filePath);

  ctx.type = 'text/javascript';
  ctx.body = transformedCode;
}
