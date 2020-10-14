import getHash from 'md5-file';

import fs from 'fs';
import path from 'path';

import { ReboostConfig, ReboostPlugin } from './index';
import { diff } from './utils';

export const createCacheHelper = (config: ReboostConfig, plugins: ReboostPlugin[]) => {
  let memoizedFilesData: {
    version: string;
    usedPlugins: string;
    mode: string;
    files: Record<string, {
      /** Unique ID of the file */
      uid: string;
      /** Hash of the file */
      hash: string;
      /** Last modified time of the file */
      mtime: number;
      /** Dependencies of the file */
      dependencies?: Record<string, {
        hash: string;
        mtime: number;
      }>;
    }>;
    dependents: Record<string, string[]>;
  };

  const getCurrentVersion = (): string => {
    const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString());
    return version;
  }

  const getUsedPlugins = () => {
    return plugins
      .filter((p) => p && p.name)
      .map((p) => {
        let id = p.name;
        if (typeof p.getId !== 'undefined') {
          id += '@' + p.getId();
        }
        return id;
      })
      .join(' && ');
  }

  const filesDataPath = () => path.join(config.cacheDir, 'cache_data.json');

  const it = {
    getFilesDir: () => path.join(config.cacheDir, 'files'),

    hasPluginsChanged: () => {
      const cachePlugins = it.filesData.usedPlugins;
      const currentPlugins = getUsedPlugins();
      return cachePlugins !== currentPlugins;
    },

    get filesData() {
      const filePath = filesDataPath();
      if (!memoizedFilesData) {
        if (fs.existsSync(filePath)) {
          memoizedFilesData = JSON.parse(fs.readFileSync(filePath).toString());
        } else {
          memoizedFilesData = {
            version: getCurrentVersion(),
            usedPlugins: getUsedPlugins(),
            mode: config.mode,
            files: {},
            dependents: {}
          };
        }
      }
      return memoizedFilesData;
    },

    saveData: () => {
      if (!memoizedFilesData) return;

      fs.writeFile(
        filesDataPath(),
        JSON.stringify(memoizedFilesData, null, config.debugMode ? 2 : 0),
        () => 0
      );
    },

    removeFile: (file: string) => {
      const filesData = it.filesData.files;
      const fileData = filesData[file];
      if (fileData) {
        filesData[file] = undefined;
        const absoluteFilePath = path.join(it.getFilesDir(), fileData.uid);
        fs.unlinkSync(absoluteFilePath);
        if (fs.existsSync(absoluteFilePath + '.map')) {
          fs.unlinkSync(absoluteFilePath + '.map');
        }
      }
    },

    removeDependents: (dependency: string) => {
      const dependentsData = it.filesData.dependents;
      const dependents = dependentsData[dependency];
      if (dependents) {
        dependentsData[dependency] = undefined;
        dependents.forEach((dependent) => it.removeFile(dependent));
      }
    },

    verifyFiles: () => {
      if (fs.existsSync(it.getFilesDir())) {
        const files = Object.keys(it.filesData.files);
        files.forEach((file) => {
          if (!fs.existsSync(file)) it.removeFile(file);
        });

        const dependencies = Object.keys(it.filesData.dependents);
        dependencies.forEach((dependency) => {
          if (!fs.existsSync(dependency)) it.removeDependents(dependency);
        });
      }

      it.saveData();
    },

    hasDependenciesChanged: async (file: string) => {
      const deps = it.filesData.files[file].dependencies;
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
      const dependentsData = it.filesData.dependents;
      const fileData = it.filesData.files[filePath];
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

      const depsData = {} as (typeof it.filesData)['files'][string]['dependencies'];
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
  }

  return it;
}
