import { ParameterizedContext } from 'koa';
import { RouterParamContext } from '@koa/router';
import hash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, getAddress, saveFilesData, getFilesDir, messageClient } from './shared';
import { ensureDir, uniqueID, diff } from './utils';
import { transformFile } from './transformer';
import { createWatcher } from './watcher';

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

const mergedDepsChanged = async (file: string) => {
  const mergedDeps = getFilesData().files[file].mergedDependencies;
  if (!mergedDeps) return false;
  for (const dependency in mergedDeps) {
    const prevHash = mergedDeps[dependency];
    const currentHash = await hash(dependency);
    if (prevHash !== currentHash) return true;
  }
  return false;
}

const updateDependencies = async (
  filePath: string,
  dependencies: string[],
  mergedDependencies: string[],
  firstTime = false
): Promise<void> => {
  const dependentsData = getFilesData().dependents;
  const fileData = getFilesData().files[filePath];
  let added: string[];
  let removed: string[];

  if (firstTime) {
    added = dependencies.concat(mergedDependencies);
    removed = [];
  } else {
    const prevDeps = fileData.dependencies;
    const prevMergedDeps = Object.keys(fileData.mergedDependencies || {});
    const depsDiff = diff(prevDeps, dependencies);
    const mergedDepsDiff = diff(prevMergedDeps, mergedDependencies);
    added = depsDiff.added.concat(mergedDepsDiff.added);
    removed = depsDiff.removed.concat(mergedDepsDiff.removed);
  }

  added.forEach((dependency) => {
    const dependents = dependentsData[dependency] || [];
    if (!dependents.includes(filePath)) dependents.push(filePath);
    dependentsData[dependency] = dependents;
  });

  removed.forEach((dependency) => {
    if (dependentsData[dependency]) {
      const dependents = dependentsData[dependency] || [];
      // Remove current file from dependents
      const filtered = dependents.filter((dependent) => dependent !== filePath);
      dependentsData[dependency] = filtered.length ? filtered : undefined;
    }
  });

  fileData.dependencies = dependencies;

  if (mergedDependencies.length === 0) return fileData.mergedDependencies = undefined;

  const mergedDepsData = {} as Record<string, string>;
  const promises: Promise<void>[] = [];

  mergedDependencies.forEach((dependency) => {
    promises.push((async () => {
      mergedDepsData[dependency] = await hash(dependency);
    })());
  });

  await Promise.all(promises);

  fileData.mergedDependencies = mergedDepsData;
}

let gitignoreCreated = false;
let watcher: ReturnType<typeof createWatcher>;

export const fileRequestHandler = async (ctx: ParameterizedContext<any, RouterParamContext<any, {}>>) => {
  const config = getConfig();
  const filesDir = getFilesDir();
  ensureDir(config.cacheDir);
  ensureDir(filesDir);

  if (!gitignoreCreated) {
    fs.writeFileSync(path.join(config.cacheDir, './.gitignore'), '/**/*');
    gitignoreCreated = true;
  }

  if (!watcher) watcher = createWatcher();

  const filePath = ctx.query.q;
  const fileHash = await hash(filePath);
  const timerName = chalk.cyan(`Response time - ${path.relative(config.rootDir, filePath)}`);
  let transformedCode: string;

  if (config.showResponseTime) console.time(timerName);

  if (getFilesData().files[filePath]) {
    const fileData = getFilesData().files[filePath];
    const outputFilePath = path.join(filesDir, fileData.uid);

    if ((fileData.hash !== fileHash) || await mergedDepsChanged(filePath)) {
      const {
        code,
        map,
        dependencies,
        mergedDependencies,
        error
      } = await transformFile(filePath);
      transformedCode = code;

      if (map) {
        // Remove other source maps
        transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
        transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
        fs.promises.writeFile(`${outputFilePath}.map`, map);
      }

      if (!error) {
        fs.promises.writeFile(outputFilePath, transformedCode);
        fileData.hash = fileHash;
        fileData.address = getAddress();
        await updateDependencies(filePath, dependencies, mergedDependencies);
        saveFilesData();
        watcher.setDependencies(filePath, mergedDependencies);
      }
    } else {
      const pure = fileData.dependencies.length === 0;
      const currentAddress = getAddress();
      transformedCode = fs.readFileSync(outputFilePath).toString();

      if (!pure && (fileData.address !== currentAddress)) {
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

      watcher.setDependencies(filePath, Object.keys(fileData.mergedDependencies || {}));
    }
  } else {
    const uid = uniqueID();
    const outputFilePath = path.join(filesDir, uid);
    const {
      code,
      map,
      dependencies,
      mergedDependencies,
      error
    } = await transformFile(filePath);
    transformedCode = code;

    if (map) {
      // Remove other source maps
      transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
      transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
      fs.promises.writeFile(`${outputFilePath}.map`, map);
    }

    if (!error) {
      fs.promises.writeFile(outputFilePath, transformedCode);
      type fileData = ReturnType<typeof getFilesData>['files'][string];
      (getFilesData().files[filePath] as Omit<fileData, 'mergedDependencies' | 'dependencies'>) = {
        uid,
        hash: fileHash,
        address: getAddress()
      };
      await updateDependencies(filePath, dependencies, mergedDependencies, true);
      saveFilesData();
      watcher.setDependencies(filePath, mergedDependencies);
    }
  }

  ctx.type = 'text/javascript';
  ctx.body = transformedCode;

  if (config.showResponseTime) console.timeEnd(timerName);
}
