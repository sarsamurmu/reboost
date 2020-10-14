import { FSWatcher } from 'chokidar';
import anymatch from 'anymatch';
import chalk from 'chalk';

import path from 'path';

import { ReboostInstance } from './index';
import { diff, getTimestamp, tLog } from './utils';
import { messageClient } from './proxy-server';

export const createWatcher = (instance: ReboostInstance) => {
  const { watchOptions } = instance.config;
  const watcher = new FSWatcher(watchOptions.chokidar);
  const dependenciesMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();

  instance.onStop("Closes proxy server's file watcher", () => watcher.close());

  const rootRelative = (filePath: string) => path.relative(instance.config.rootDir, filePath);

  watcher.on('change', (filePath) => {
    filePath = path.normalize(filePath);
    
    tLog('info', chalk.blue(`${getTimestamp()} Changed: ${rootRelative(filePath)}`));
    if (!dependentsMap.has(filePath)) return;

    const dependents = dependentsMap.get(filePath);
    dependents.forEach((dependent) => {
      messageClient({
        type: 'change',
        file: dependent
      });
    });
  });

  watcher.on('unlink', (filePath) => {
    filePath = path.normalize(filePath);
    
    tLog('info', chalk.blue(`${getTimestamp()} Deleted: ${rootRelative(filePath)}`));
    if (!dependentsMap.has(filePath)) return;

    dependentsMap.delete(filePath);

    instance.cache.removeDependents(filePath);
    instance.cache.saveData();

    messageClient({
      type: 'unlink'
    })
  });

  const shouldWatch = (filePath: string) => (
    anymatch(watchOptions.include, filePath) &&
    !anymatch(watchOptions.exclude, filePath)
  );

  return {
    setDependencies: (file: string, dependencies: string[]) => {
      file = path.normalize(file);

      if (shouldWatch(file)) {
        const prevDependencies = dependenciesMap.get(file) || [];
        const dependenciesCopy = dependencies.map((p) => path.normalize(p));
        // The file itself is also the file's dependency
        dependenciesCopy.unshift(file);

        const { added, removed } = diff(prevDependencies, dependenciesCopy);

        added.forEach((dependency) => {
          if (!dependentsMap.has(dependency) && shouldWatch(dependency)) {
            watcher.add(dependency);
            tLog('watchList', chalk.blue(`Watching ${rootRelative(dependency)}`));
          }
          const dependents = dependentsMap.get(dependency) || [];
          if (!dependents.includes(file)) dependents.push(file);
          dependentsMap.set(dependency, dependents);
        });

        removed.forEach((dependency) => {
          const dependents = dependentsMap.get(dependency) || [];
          // Remove file from dependents
          const filtered = dependents.filter((dependent) => dependent !== file);
          if (filtered.length === 0 && shouldWatch(dependency)) {
            dependentsMap.delete(dependency);
            watcher.unwatch(dependency);
            tLog('watchList', chalk.blue(`Unwatched ${rootRelative(dependency)}`));
            return;
          }
          dependentsMap.set(dependency, filtered);
        });

        dependenciesMap.set(file, dependenciesCopy);
      }
    }
  }
}
