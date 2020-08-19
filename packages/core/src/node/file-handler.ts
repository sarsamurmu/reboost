import { ParameterizedContext } from 'koa';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, getAddress, saveFilesData, getFilesDir } from './shared';
import { ensureDir, uniqueID, diff, toPosix, getReadableHRTime } from './utils';
import { transformFile } from './transformer';
import { createWatcher } from './watcher';
import { ReboostConfig } from './index';

export const removeFile = (file: string) => {
  const filesData = getFilesData().files;
  const fileData = filesData[file];
  if (fileData) {
    filesData[file] = undefined;
    const absoluteFilePath = path.join(getFilesDir(), fileData.uid);
    fs.unlinkSync(absoluteFilePath);
    if (fs.existsSync(absoluteFilePath + '.map')) {
      fs.unlinkSync(absoluteFilePath + '.map');
    }
  }
}

export const removeDependents = (dependency: string) => {
  const dependentsData = getFilesData().dependents;
  const dependents = dependentsData[dependency];
  if (dependents) {
    dependentsData[dependency] = undefined;
    dependents.forEach((dependent) => removeFile(dependent));
  }
}

export const verifyFiles = () => {
  if (fs.existsSync(getFilesDir())) {
    const files = Object.keys(getFilesData().files);
    files.forEach((file) => {
      if (!fs.existsSync(file)) removeFile(file);
    });

    const dependencies = Object.keys(getFilesData().dependents);
    dependencies.forEach((dependency) => {
      if (!fs.existsSync(dependency)) removeDependents(dependency);
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

export const createFileHandler = () => {
  let initialized = false;
  let config: ReboostConfig;
  let filesDir: string;
  let watcher: ReturnType<typeof createWatcher>;
  const memoizedFiles = new Map();
  const noop = () => {/* No Operation */};

  return async (ctx: ParameterizedContext) => {
    if (!initialized) {
      config = getConfig();
      filesDir = getFilesDir();
      watcher = createWatcher();

      ensureDir(config.cacheDir);
      ensureDir(filesDir);

      fs.writeFile(path.join(config.cacheDir, './.gitignore'), '/**/*', noop);

      initialized = true;
    }

    const filePath = ctx.query.q;
    let startTime: [number, number];
    let transformedCode: string;

    if (config.showResponseTime) startTime = process.hrtime();

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
            fs.writeFile(`${outputFilePath}.map`, map, noop);
          }

          if (!error) {
            if (map || imports.length) pure = undefined;
            fs.writeFile(outputFilePath, transformedCode, noop);
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

            fs.writeFile(outputFilePath, transformedCode, noop);

            if (fs.existsSync(`${outputFilePath}.map`)) {
              const fileMap = fs.readFileSync(`${outputFilePath}.map`).toString();
              fs.writeFile(`${outputFilePath}.map`, fileMap.replace(addressRegex, currentAddress), noop);
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
          fs.writeFile(`${outputFilePath}.map`, map, noop);
        }

        if (!error) {
          if (map || imports.length) pure = undefined;
          fs.writeFile(outputFilePath, transformedCode, noop);
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

    if (config.showResponseTime) {
      const endTime = process.hrtime(startTime);
      console.log(
        chalk.cyan(`Response time - ${toPosix(path.relative(config.rootDir, filePath))}:`),
        chalk.white(getReadableHRTime(endTime))
      );
    }
  }
}
