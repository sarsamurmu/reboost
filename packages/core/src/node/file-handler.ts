import Koa from 'koa';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { ensureDir, uniqueID, diff, toPosix, getReadableHRTime, logEnabled, tLog } from './utils';
import { createTransformer } from './transformer';
import { createWatcher } from './watcher';
import { ReboostConfig, ReboostInstance } from './index';

export const removeFile = ({ shared }: ReboostInstance, file: string) => {
  const filesData = shared.getFilesData().files;
  const fileData = filesData[file];
  if (fileData) {
    filesData[file] = undefined;
    const absoluteFilePath = path.join(shared.getFilesDir(), fileData.uid);
    fs.unlinkSync(absoluteFilePath);
    if (fs.existsSync(absoluteFilePath + '.map')) {
      fs.unlinkSync(absoluteFilePath + '.map');
    }
  }
}

export const removeDependents = (instance: ReboostInstance, dependency: string) => {
  const dependentsData = instance.shared.getFilesData().dependents;
  const dependents = dependentsData[dependency];
  if (dependents) {
    dependentsData[dependency] = undefined;
    dependents.forEach((dependent) => removeFile(instance, dependent));
  }
}

export const verifyFiles = (instance: ReboostInstance) => {
  const { shared } = instance;
  if (fs.existsSync(shared.getFilesDir())) {
    const files = Object.keys(shared.getFilesData().files);
    files.forEach((file) => {
      if (!fs.existsSync(file)) removeFile(instance, file);
    });

    const dependencies = Object.keys(shared.getFilesData().dependents);
    dependencies.forEach((dependency) => {
      if (!fs.existsSync(dependency)) removeDependents(instance, dependency);
    });
  }

  shared.saveFilesData();
}

const depsChanged = async ({ shared }: ReboostInstance, file: string) => {
  const deps = shared.getFilesData().files[file].dependencies;
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
  { shared }: ReboostInstance,
  filePath: string,
  dependencies: string[],
  firstTime = false
): Promise<void> => {
  const dependentsData = shared.getFilesData().dependents;
  const fileData = shared.getFilesData().files[filePath];
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

  const depsData = {} as ReturnType<typeof shared.getFilesData>['files'][string]['dependencies'];
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

const sourceMapCommentRE = /^[ \t]*\/\/#\s*sourceMappingURL=.+(?![\s\S]*\/\/#\s*sourceMappingURL=.+)/m;
const fixSourceMap = (code: string, cacheFilePath: string) => {
  // Remove other source maps
  return `${code.replace(sourceMapCommentRE, '')}\n//# sourceMappingURL=/raw?q=${encodeURIComponent(cacheFilePath)}.map`;
}

export const createFileHandler = (instance: ReboostInstance) => {
  let initialized = false;
  let filesDir: string;
  let transformer: ReturnType<typeof createTransformer>;
  let watcher: ReturnType<typeof createWatcher>;
  const { config } = instance;
  const memoizedFiles = new Map<string, string>();
  const noop = () => {/* No Operation */};

  const { getFilesDir, getFilesData, saveFilesData } = instance.shared;

  return async (ctx: Koa.Context) => {
    if (!initialized) {
      filesDir = getFilesDir();
      transformer = createTransformer(instance);
      watcher = createWatcher(instance);

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
        } = await transformer.transformFile(filePath);
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
          await updateDependencies(instance, filePath, dependencies, true);
          saveFilesData();
        }

        if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
        watcher.setDependencies(filePath, dependencies);
        
        ctx.set('ETag', mtime + '');
      }

      if (getFilesData().files[filePath]) {
        const fileData = getFilesData().files[filePath];
        const outputFilePath = path.join(filesDir, fileData.uid);
        let hash: string;

        try {
          if (
            await depsChanged(instance, filePath) ||
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
            } = await transformer.transformFile(filePath);
            transformedCode = code;

            if (map) {
              transformedCode = fixSourceMap(transformedCode, outputFilePath);
              fs.writeFile(`${outputFilePath}.map`, map, noop);
            }

            if (!error) {
              fs.writeFile(outputFilePath, transformedCode, noop);
              fileData.hash = hash;
              fileData.mtime = mtime;
              await updateDependencies(instance, filePath, dependencies);
              saveFilesData();
            }

            if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
            watcher.setDependencies(filePath, dependencies);

            ctx.set('ETag', mtime + '');
          } else {
            if (ctx.get('If-None-Match') === mtime + '') {
              ctx.status = 304;
            } else {
              transformedCode = config.cacheOnMemory && memoizedFiles.get(filePath) || fs.readFileSync(outputFilePath).toString();

              if (fileData.mtime !== mtime) {
                fileData.mtime = mtime;
                saveFilesData();
              }

              if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
            }
            
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

    if (transformedCode) {
      ctx.type = 'text/javascript';
      ctx.body = transformedCode;
    }

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
