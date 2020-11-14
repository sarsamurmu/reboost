import getHash from 'md5-file';

import fs from 'fs';
import path from 'path';

import { ReboostConfig, ReboostPlugin } from './index';
import { diff, observable, serializeObject, md5 } from './utils';

export interface CacheInfo {
  /** Hash of the file */
  hash: string;
  /** Last modified time of the file */
  mtime: number;
  /** Plugins used in the file */
  plugins: string;
  /** Mode used in the file */
  mode: string;
  /** Dependencies of the file */
  dependencies?: {
    [filePath: string]: {
      hash: string;
      mtime: number;
    }
  };
}

type CacheInfoRecord = { [cacheID: string]: CacheInfo };

export const initCache = (
  config: ReboostConfig,
  plugins: ReboostPlugin[],
  instanceOnStop: (label: string, cb: () => Promise<any> | any) => void
) => {
  let unsavedCacheInfos: CacheInfoRecord = {};
  const noop = () => {/* No Operation */}

  const getCurrentVersion = (): string => {
    const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
    return version;
  }
  
  const versionFilePath = () => path.join(config.cacheDir, 'version');
  const cacheIDsFilePath = () => path.join(config.cacheDir, 'cache_id_map.json');
  const dependentsDataFilePath = () => path.join(config.cacheDir, 'dependents_data.json');

  const memoized = {
    cacheVersion: undefined as string,
    cacheIDs: undefined as Record<string, string>,
    dependentsData: undefined as Record<string, string[]>
  }
  const needsSave = {
    cacheVersion: false,
    cacheIDs: false,
    dependentsData: false,
  }

  const fsWritePromises = new Set<Promise<any>>();
  instanceOnStop('Cache file write', () => Promise.all([...fsWritePromises]));

  const it = {
    getFilesDir: () => path.join(config.cacheDir, 'files'),

    cacheFilePath: (cacheID: string) => path.join(it.getFilesDir(), cacheID + (config.debugMode ? '.js' : '')),
    sourceMapPath: (cacheID: string) => path.join(it.getFilesDir(), cacheID + (config.debugMode ? '.js' : '') + '.map'),
    cacheInfoFilePath: (cacheID: string) => path.join(it.getFilesDir(), cacheID + '.json'),

    getCurrentPlugins: () => {
      return plugins
        .filter((p) => p && p.name)
        .map((p) => {
          let id = p.name;
          if (typeof p.getCacheKey === 'function') {
            id += '@' + p.getCacheKey({ serializeObject, md5 });
          }
          return id;
        })
        .join(' && ');
    },

    get version(): string {
      if (!memoized.cacheVersion) {
        memoized.cacheVersion = fs.existsSync(versionFilePath())
          ? fs.readFileSync(versionFilePath()).toString()
          : getCurrentVersion();
        needsSave.cacheVersion = true;
      }
      return memoized.cacheVersion;
    },
    get cacheIDs(): { [filePath: string]: string } {
      if (!memoized.cacheIDs) {
        const cacheIDs = fs.existsSync(cacheIDsFilePath())
          ? JSON.parse(fs.readFileSync(cacheIDsFilePath()).toString())
          : {};
        memoized.cacheIDs = observable(cacheIDs, () => {
          needsSave.cacheIDs = true;
        });
      }
      return memoized.cacheIDs;
    },
    get dependentsData(): { [filePath: string]: string[] } {
      if (!memoized.dependentsData) {
        const dependentsData = fs.existsSync(dependentsDataFilePath())
          ? JSON.parse(fs.readFileSync(dependentsDataFilePath()).toString())
          : {};
        memoized.dependentsData = observable(dependentsData, () => {
          needsSave.dependentsData = true;
        });
      }
      return memoized.dependentsData;
    },

    cacheInfo: new Proxy({} as CacheInfoRecord, {
      get: (cacheInfos, cacheID: string) => {
        if (!cacheInfos[cacheID]) {
          const cacheInfo: CacheInfo = JSON.parse(
            fs.readFileSync(it.cacheInfoFilePath(cacheID)).toString()
          );
          cacheInfos[cacheID] = observable(cacheInfo, () => {
            unsavedCacheInfos[cacheID] = cacheInfo;
          });
        }

        return cacheInfos[cacheID];
      },
      set: (cacheInfos, cacheID: string, cacheInfo: CacheInfo) => {
        if (typeof cacheInfo === 'undefined') {
          cacheInfos[cacheID] = undefined;
          return true;
        }
        cacheInfos[cacheID] = observable(cacheInfo, () => {
          unsavedCacheInfos[cacheID] = cacheInfo;
        });
        unsavedCacheInfos[cacheID] = cacheInfo;
        return true;
      }
    }),

    saveData: () => {
      const promises: Promise<void>[] = [];
      const stringify = (json: Record<any, any>) => JSON.stringify(json, null, config.debugMode ? 2 : 0);

      if (needsSave.cacheVersion) {
        promises.push(fs.promises.writeFile(versionFilePath(), it.version));
        needsSave.cacheVersion = false;
      }
      if (needsSave.cacheIDs) {
        promises.push(fs.promises.writeFile(cacheIDsFilePath(), stringify(it.cacheIDs)));
        needsSave.cacheIDs = false;
      }
      if (needsSave.dependentsData) {
        promises.push(fs.promises.writeFile(dependentsDataFilePath(), stringify(it.dependentsData)));
        needsSave.dependentsData = false;
      }

      Object.keys(unsavedCacheInfos).forEach((cacheID) => {
        promises.push(fs.promises.writeFile(
          it.cacheInfoFilePath(cacheID),
          stringify(unsavedCacheInfos[cacheID])
        ));
      });
      unsavedCacheInfos = {};

      const allPromise = Promise.all(promises);
      fsWritePromises.add(allPromise);
      allPromise.then(() => fsWritePromises.delete(allPromise));
    },

    removeFile: (file: string) => {
      const cacheID = it.cacheIDs[file];
      if (cacheID) {
        it.cacheIDs[file] = undefined;
        it.cacheInfo[cacheID] = undefined;
        fs.unlink(it.cacheFilePath(cacheID), noop);
        fs.unlink(it.cacheInfoFilePath(cacheID), noop);
        if (fs.existsSync(it.sourceMapPath(cacheID))) {
          fs.unlink(it.sourceMapPath(cacheID), noop);
        }
      }
    },

    removeDependents: (dependency: string) => {
      const dependentsData = it.dependentsData;
      const dependents = dependentsData[dependency];
      if (dependents) {
        dependentsData[dependency] = undefined;
        dependents.forEach((dependent) => it.removeFile(dependent));
      }
    },

    verifyFiles: () => {
      if (fs.existsSync(it.getFilesDir())) {
        const files = Object.keys(it.cacheIDs);
        files.forEach((file) => {
          if (!fs.existsSync(file)) it.removeFile(file);
        });

        const dependencies = Object.keys(it.dependentsData);
        dependencies.forEach((dependency) => {
          if (!fs.existsSync(dependency)) it.removeDependents(dependency);
        });
      }

      it.saveData();
    },

    hasDependenciesChanged: async (file: string) => {
      const deps = it.cacheInfo[it.cacheIDs[file]].dependencies;
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
    },

    updateDependencies: async (
      filePath: string,
      dependencies: string[],
      firstTime = false
    ): Promise<void> => {
      const dependentsData = it.dependentsData;
      const cacheInfo = it.cacheInfo[it.cacheIDs[filePath]];
      let added: string[];
      let removed: string[];

      if (firstTime) {
        added = dependencies;
        removed = [];
      } else {
        const prevDeps = Object.keys(cacheInfo.dependencies || {});
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

      if (dependencies.length === 0) return cacheInfo.dependencies = undefined;

      const depsData = {} as CacheInfo['dependencies'];

      await Promise.all(dependencies.map((dependency) => (
        (async () => {
          if (fs.existsSync(dependency)) {
            depsData[dependency] = {
              hash: await getHash(dependency),
              mtime: Math.floor(fs.statSync(dependency).mtimeMs)
            }
          } else {
            depsData[dependency] = {} as any;
          }
        })()
      )));

      cacheInfo.dependencies = depsData;
    }
  }

  return it;
}
