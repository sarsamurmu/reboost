import { FSWatcher } from 'chokidar';
import anymatch from 'anymatch';
import chalk from 'chalk';

import path from 'path';

import { getConfig, saveFilesData } from './shared';
import { diff, getTimestamp } from './utils';
import { messageClient } from './proxy-server';
import { removeDependents } from './file-handler';

export const createWatcher = () => {
  const { watchOptions } = getConfig();
  const watcher = new FSWatcher(watchOptions.chokidar);
  const dependenciesMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();
  const log = false && getConfig().debugMode;
  const rootRelative = (filePath: string) => path.relative(getConfig().rootDir, filePath);

  watcher.on('change', (filePath) => {
    filePath = path.normalize(filePath);
    
    console.log(chalk.blue(`${getTimestamp()} Changed: ${rootRelative(filePath)}`));
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
    filePath = path.normalize(filePath);
    
    console.log(chalk.blue(`${getTimestamp()} Deleted: ${rootRelative(filePath)}`));
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

  return { setDependencies }
}
