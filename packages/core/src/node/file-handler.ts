import { ParameterizedContext } from 'koa';
import { RouterParamContext } from '@koa/router';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, getAddress, saveFilesData, getFilesDir } from './shared';
import { ensureDir, uniqueID, diff, toPosix } from './utils';
import { transformFile } from './transformer';
import { createWatcher, removeFile } from './watcher';

export const verifyFiles = () => {
  if (fs.existsSync(getFilesDir())) {
    const files = Object.keys(getFilesData().files);
    files.forEach((file) => {
      if (!fs.existsSync(file)) removeFile(file);
    });

    const dependentsData = getFilesData().dependents;
    const dependencies = Object.keys(dependentsData);
    dependencies.forEach((dependency) => {
      if (!fs.existsSync(dependency)) {
        dependentsData[dependency].forEach((file) => {
          removeFile(file);
        });
      }
    });
  }
  saveFilesData();
}

const depsChanged = async (file: string) => {
  const deps = getFilesData().files[file].dependencies;
  if (!deps) return false;
  for (const dependency in deps) {
    try {
      const dependencyMeta = deps[dependency];
      const currentMtime = Math.floor(fs.statSync(dependency).mtimeMs);

      if (dependencyMeta.mtime === currentMtime) continue;

      const currentHash = await getHash(dependency);
      if (dependencyMeta.hash !== currentHash) return true;
    } catch (e) {
      // Probably the `fs.statSync` function caused error if
      // the dependency file is unavailable
      return true;
    }
  }
  return false;
}

const updateDependencies = async (
  filePath: string,
  dependencies: string[],
  firstTime = false
): Promise<void> => {
  const dependentsData = getFilesData().dependents;
  const fileData = getFilesData().files[filePath];
  let added: string[];
  let removed: string[];

  if (firstTime) {
    added = dependencies;
    removed = [];
  } else {
    const prevDeps = Object.keys(fileData.dependencies || {});
    ({ added, removed } = diff(prevDeps, dependencies));
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

  if (dependencies.length === 0) return fileData.dependencies = undefined;

  const depsData = {} as ReturnType<typeof getFilesData>['files'][string]['dependencies'];
  const promises: Promise<void>[] = [];

  dependencies.forEach((dependency) => {
    promises.push((async () => {
      depsData[dependency] = {
        hash: await getHash(dependency),
        mtime: Math.floor(fs.statSync(dependency).mtimeMs)
      };
    })());
  });

  await Promise.all(promises);

  fileData.dependencies = depsData;
}

let gitignoreCreated = false;
let watcher: ReturnType<typeof createWatcher>;
const memoizedFiles = new Map();

export const fileRequestHandler = async (ctx: ParameterizedContext<any, RouterParamContext<any, any>>) => {
  const config = getConfig();
  const filesDir = getFilesDir();
  ensureDir(config.cacheDir);
  ensureDir(filesDir);

  if (!gitignoreCreated) {
    fs.promises.writeFile(path.join(config.cacheDir, './.gitignore'), '/**/*');
    gitignoreCreated = true;
  }

  if (!watcher) watcher = createWatcher();

  const filePath = ctx.query.q;
  const timerName = chalk.cyan(`Response time - ${toPosix(path.relative(config.rootDir, filePath))}`);
  let transformedCode: string;

  if (config.showResponseTime) console.time(timerName);

  if (fs.existsSync(filePath)) {
    const mtime = Math.floor(fs.statSync(filePath).mtimeMs);

    if (getFilesData().files[filePath]) {
      const fileData = getFilesData().files[filePath];
      const outputFilePath = path.join(filesDir, fileData.uid);
      let hash: string;

      if (
        await depsChanged(filePath) ||
        (
          (fileData.mtime !== mtime) &&
          (fileData.hash !== (hash = await getHash(filePath)))
        )
      ) {
        let pure = true;
        const {
          code,
          map,
          imports,
          dependencies,
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
          if (map || imports.length) pure = undefined;
          fs.promises.writeFile(outputFilePath, transformedCode);
          fileData.hash = hash;
          fileData.mtime = mtime;
          fileData.address = getAddress();
          fileData.pure = pure;
          await updateDependencies(filePath, dependencies);
          saveFilesData();
        }

        if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
        watcher.setDependencies(filePath, dependencies);
      } else {
        const pure = fileData.pure;
        const currentAddress = getAddress();
        transformedCode = config.cacheOnMemory && memoizedFiles.get(filePath) || fs.readFileSync(outputFilePath).toString();

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

        if (fileData.mtime !== mtime) {
          fileData.mtime = mtime;
          saveFilesData();
        }

        if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
        watcher.setDependencies(filePath, Object.keys(fileData.dependencies || {}));
      }
    } else {
      let pure = true;
      const uid = uniqueID();
      const outputFilePath = path.join(filesDir, uid);
      const {
        code,
        map,
        imports,
        dependencies,
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
        if (map || imports.length) pure = undefined;
        fs.promises.writeFile(outputFilePath, transformedCode);
        type fileData = ReturnType<typeof getFilesData>['files'][string];
        (getFilesData().files[filePath] as Omit<fileData, 'mergedDependencies' | 'dependencies'>) = {
          uid,
          hash: await getHash(filePath),
          mtime,
          address: getAddress(),
          pure
        };
        await updateDependencies(filePath, dependencies, true);
        saveFilesData();
      }

      if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
      watcher.setDependencies(filePath, dependencies);
    }
  } else {
    const message = `[reboost] The requested file does not exist: ${filePath}.`;
    transformedCode = `console.error(${JSON.stringify(message)})`;
  }

  ctx.type = 'text/javascript';
  ctx.body = transformedCode;

  if (config.showResponseTime) console.timeEnd(timerName);
}
