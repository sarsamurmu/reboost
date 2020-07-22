import { FSWatcher } from 'chokidar';
import anymatch from 'anymatch';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, messageClient, getFilesData, getFilesDir, saveFilesData } from './shared';
import { diff } from './utils';

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
    dependents.forEach((dependent) => {
      removeFile(dependent);
    });
  }
}

export const createWatcher = () => {
  const { watchOptions } = getConfig();
  const watcher = new FSWatcher(watchOptions.chokidar);
  const dependenciesMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();
  const log = false && getConfig().debugMode;

  watcher.on('change', (filePath) => {
    console.log(chalk.blue(`Changed: ${path.relative(getConfig().rootDir, filePath)}`));
    if (!dependentsMap.has(filePath)) return;

    const dependents = dependentsMap.get(filePath);
    log && console.log('Dependents', dependents);
    dependents.forEach((dependent) => {
      messageClient({
        type: 'change',
        file: dependent
      });
    });
  });

  watcher.on('unlink', (filePath) => {
    console.log(chalk.blue(`Deleted: ${path.relative(getConfig().rootDir, filePath)}`));
    if (!dependentsMap.has(filePath)) return;

    dependentsMap.delete(filePath);

    removeDependents(filePath);
    saveFilesData();

    messageClient({
      type: 'unlink'
    })
  });

  const setDependencies = (file: string, dependencies: string[]) => {
    file = path.normalize(file);

    if (
      !anymatch(watchOptions.exclude, file) && // Not excluded
      anymatch(watchOptions.include, file) // and included
    ) {
      const prevDependencies = dependenciesMap.get(file) || [];
      const dependenciesCopy = dependencies.map((p) => path.normalize(p));
      // The file itself is also the file's dependency
      dependenciesCopy.unshift(file);

      const { added, removed } = diff(prevDependencies, dependenciesCopy);

      added.forEach((dependency) => {
        if (!dependentsMap.has(dependency)) {
          watcher.add(dependency);
          log && console.log(`Watching ${dependency}`);
        }
        const dependents = dependentsMap.get(dependency) || [];
        if (!dependents.includes(file)) dependents.push(file);
        dependentsMap.set(dependency, dependents);
      });

      removed.forEach((dependency) => {
        const dependents = dependentsMap.get(dependency) || [];
        // Remove file from dependents
        const filtered = dependents.filter((dependent) => dependent !== file);
        if (filtered.length === 0) {
          dependentsMap.delete(dependency);
          watcher.unwatch(dependency);
          log && console.log(`Unwatched ${dependency}`);
          return;
        }
        dependentsMap.set(dependency, filtered);
      });

      dependenciesMap.set(file, dependenciesCopy);
    }
  }

  return {
    setDependencies
  }
}
