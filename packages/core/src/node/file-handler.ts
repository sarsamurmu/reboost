import { ParameterizedContext } from 'koa';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, saveFilesData, getFilesDir } from './shared';
import { ensureDir, uniqueID, diff, toPosix, getReadableHRTime, logEnabled, tLog } from './utils';
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

const fixSourceMap = (code: string, cacheFilePath: string) => {
  // Remove other source maps
  return `${code.replace(/\/\/#\s*sourceMappingURL=.*/g, '')}\n//# sourceMappingURL=/raw?q=${encodeURI(cacheFilePath)}.map`;
}

export const createFileHandler = () => {
  let initialized = false;
  let config: ReboostConfig;
  let filesDir: string;
  let watcher: ReturnType<typeof createWatcher>;
  const memoizedFiles = new Map<string, string>();
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

    if (logEnabled('responseTime')) startTime = process.hrtime();

    if (fs.existsSync(filePath)) {
      const mtime = Math.floor(fs.statSync(filePath).mtimeMs);

      const makeNewCache = async () => {
        const uid = uniqueID();
        const outputFilePath = path.join(filesDir, uid);
        const {
          code,
          map,
          dependencies,
          error
        } = await transformFile(filePath);
        transformedCode = code;

        if (map) {
          transformedCode = fixSourceMap(transformedCode, outputFilePath);
          fs.writeFile(`${outputFilePath}.map`, map, noop);
        }

        if (!error) {
          fs.writeFile(outputFilePath, transformedCode, noop);
          getFilesData().files[filePath] = {
            uid,
            hash: await getHash(filePath),
            mtime
          };
          await updateDependencies(filePath, dependencies, true);
          saveFilesData();
        }

        if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
        watcher.setDependencies(filePath, dependencies);
      }

      if (getFilesData().files[filePath]) {
        const fileData = getFilesData().files[filePath];
        const outputFilePath = path.join(filesDir, fileData.uid);
        let hash: string;

        try {
          if (
            await depsChanged(filePath) ||
            (
              (fileData.mtime !== mtime) &&
              (fileData.hash !== (hash = await getHash(filePath)))
            )
          ) {
            const {
              code,
              map,
              dependencies,
              error
            } = await transformFile(filePath);
            transformedCode = code;

            if (map) {
              transformedCode = fixSourceMap(transformedCode, outputFilePath);
              fs.writeFile(`${outputFilePath}.map`, map, noop);
            }

            if (!error) {
              fs.writeFile(outputFilePath, transformedCode, noop);
              fileData.hash = hash;
              fileData.mtime = mtime;
              await updateDependencies(filePath, dependencies);
              saveFilesData();
            }

            if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
            watcher.setDependencies(filePath, dependencies);
          } else {
            transformedCode = config.cacheOnMemory && memoizedFiles.get(filePath) || fs.readFileSync(outputFilePath).toString();

            if (fileData.mtime !== mtime) {
              fileData.mtime = mtime;
              saveFilesData();
            }

            if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
            watcher.setDependencies(filePath, Object.keys(fileData.dependencies || {}));
          }
        } catch (e) {
          if (e.message.includes('ENOENT')) {
            await makeNewCache();
          } else {
            console.error(e);
          }
        }
      } else {
        await makeNewCache();
      }
    } else {
      const message = `[reboost] The requested file does not exist: ${filePath}.`;
      transformedCode = `console.error(${JSON.stringify(message)})`;
    }

    ctx.type = 'text/javascript';
    ctx.body = transformedCode;

    if (logEnabled('responseTime')) {
      const endTime = process.hrtime(startTime);
      tLog(
        'responseTime',
        chalk.cyan(`Response time - ${toPosix(path.relative(config.rootDir, filePath))}:`),
        chalk.white(getReadableHRTime(endTime))
      );
    }
  }
}
