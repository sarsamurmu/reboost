import Koa from 'koa';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { ensureDir, uniqueID, toPosix, getReadableHRTime } from './utils';
import { createTransformer } from './transformer';
import { createWatcher } from './watcher';
import { ReboostInstance } from './index';

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
  const { config, cache } = instance;
  const memoizedFiles = new Map<string, string>();
  const noop = () => {/* No Operation */};

  const getETag = (filePath: string) => {
    let eTag: string = '' + Math.floor(fs.statSync(filePath).mtimeMs);

    const deps = instance.cache.filesData.files[filePath].dependencies;
    if (deps) {
      Object.keys(deps).sort().forEach((dependency) => {
        try {
          eTag += Math.floor(fs.statSync(dependency).mtimeMs);
        } catch (e) {/* Do nothing */}
      });
    }

    return eTag;
  }

  return async (ctx: Koa.Context) => {
    if (!initialized) {
      filesDir = cache.getFilesDir();
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

    if (instance.isLogEnabled('responseTime')) startTime = process.hrtime();

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
          cache.filesData.files[filePath] = {
            uid,
            hash: await getHash(filePath),
            mtime
          };
          await cache.updateDependencies(filePath, dependencies, true);
          cache.saveData();
          if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
          ctx.set('ETag', getETag(filePath));
        }

        watcher.setDependencies(filePath, dependencies);
      }

      if (cache.filesData.files[filePath]) {
        const fileData = cache.filesData.files[filePath];
        const outputFilePath = path.join(filesDir, fileData.uid);
        let hash: string;

        try {
          if (
            await cache.hasDependenciesChanged(filePath) ||
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
              await cache.updateDependencies(filePath, dependencies);
              cache.saveData();
              if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
              ctx.set('ETag', getETag(filePath));
            }

            watcher.setDependencies(filePath, dependencies);
          } else {
            if (ctx.get('If-None-Match') === getETag(filePath)) {
              ctx.status = 304;
            } else {
              transformedCode = config.cacheOnMemory && memoizedFiles.get(filePath) || fs.readFileSync(outputFilePath).toString();

              if (fileData.mtime !== mtime) {
                fileData.mtime = mtime;
                cache.saveData();
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

    if (instance.isLogEnabled('responseTime')) {
      const endTime = process.hrtime(startTime);
      instance.log(
        'responseTime',
        chalk.cyan(`Response time - ${toPosix(path.relative(config.rootDir, filePath))}:`),
        chalk.white(getReadableHRTime(endTime))
      );
    }
  }
}
