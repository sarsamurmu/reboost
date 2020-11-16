import Koa from 'koa';
import getHash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { ensureDir, toPosix, getReadableHRTime, uniqueID } from './utils';
import { createTransformer } from './transformer';
import { createWatcher } from './watcher';
import { ReboostInstance } from './index';

const sourceMapCommentRE = /^[ \t]*\/\/#\s*sourceMappingURL=.+(?![\s\S]*\/\/#\s*sourceMappingURL=.+)/m;
const fixSourceMap = (code: string, sourceMapPath: string) => {
  // Remove other source maps
  return `${code.replace(sourceMapCommentRE, '')}\n//# sourceMappingURL=/raw?q=${encodeURIComponent(sourceMapPath)}`;
}

export const createFileHandler = (instance: ReboostInstance) => {
  let initialized = false;
  let filesDir: string;
  let transformer: ReturnType<typeof createTransformer>;
  let watcher: ReturnType<typeof createWatcher>;
  let currentPlugins: string;
  const { config, cache } = instance;
  const memoizedFiles = new Map<string, string>();
  const noop = () => {/* No Operation */};

  const eTagBase = `
    mtime: "@mtime"
    plugins: "@plugins"
    dependentsMtime: "@dependentsMtime"
  `.split('\n').map((s) => s.trim()).join('\n').trim();

  const getETag = (filePath: string) => {
    const mtime = Math.floor(fs.statSync(filePath).mtimeMs) + '';
    let dependentsMtime = '';

    const deps = cache.cacheInfo[cache.cacheIDs[filePath]].dependencies;
    if (deps) {
      dependentsMtime = Object.keys(deps).sort().map((dependency) => {
        try {
          return Math.floor(fs.statSync(dependency).mtimeMs);
        } catch (e) { return '' }
      }).join('-');
    }

    const eTagStr = eTagBase
      .replace('@mtime', mtime)
      .replace('@plugins', currentPlugins)
      .replace('@dependentsMtime', dependentsMtime);
    const eTag = crypto.createHash('md5').update(eTagStr).digest('hex');

    return eTag;
  }

  return async (ctx: Koa.Context) => {
    if (!initialized) {
      filesDir = cache.getFilesDir();
      transformer = createTransformer(instance);
      watcher = createWatcher(instance);
      currentPlugins = cache.getCurrentPlugins();

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
        const cacheID = (config.debugMode ? path.basename(filePath) + '-' : '') + uniqueID(16);
        const {
          code,
          map,
          dependencies,
          error
        } = await transformer.transformFile(filePath);
        transformedCode = code;

        if (map) {
          const sourceMapPath = cache.sourceMapPath(cacheID);
          transformedCode = fixSourceMap(transformedCode, sourceMapPath);
          fs.writeFile(sourceMapPath, map, noop);
        }

        if (!error) {
          fs.writeFileSync(cache.cacheFilePath(cacheID), transformedCode);
          cache.cacheIDs[filePath] = cacheID;
          cache.cacheInfo[cacheID] = {
            hash: await getHash(filePath),
            mtime,
            plugins: currentPlugins
          };
          await cache.updateDependencies(filePath, dependencies, true);
          cache.saveData();
          if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
          ctx.set('ETag', getETag(filePath));
        }

        watcher.setDependencies(filePath, dependencies);
      }

      if (cache.cacheIDs[filePath]) {
        const cacheID = cache.cacheIDs[filePath];
        const cacheInfo = cache.cacheInfo[cacheID];
        const cacheFilePath = cache.cacheFilePath(cacheID);
        let hash: string;

        try {
          if (
            cacheInfo.plugins !== currentPlugins ||
            await cache.hasDependenciesChanged(filePath) ||
            (
              (cacheInfo.mtime !== mtime) &&
              (cacheInfo.hash !== (hash = await getHash(filePath)))
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
              const sourceMapPath = cache.sourceMapPath(cacheID);
              transformedCode = fixSourceMap(transformedCode, sourceMapPath);
              fs.writeFile(sourceMapPath, map, noop);
            }

            if (!error) {
              fs.writeFileSync(cacheFilePath, transformedCode);
              cacheInfo.hash = hash;
              cacheInfo.mtime = mtime;
              cacheInfo.plugins = currentPlugins;
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
              transformedCode = config.cacheOnMemory && memoizedFiles.get(filePath) || fs.readFileSync(cacheFilePath).toString();

              if (cacheInfo.mtime !== mtime) {
                cacheInfo.mtime = mtime;
                cache.saveData();
              }

              if (config.cacheOnMemory) memoizedFiles.set(filePath, transformedCode);
            }
            
            watcher.setDependencies(filePath, Object.keys(cacheInfo.dependencies || {}));
          }
        } catch (e) {
          if (e.message.includes('ENOENT')) {
            await makeNewCache();
          }
          console.error(e);
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
        getReadableHRTime(endTime)
      );
    }
  }
}
