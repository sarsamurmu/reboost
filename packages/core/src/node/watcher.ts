import { FSWatcher } from 'chokidar';
import anymatch from 'anymatch';
import chalk from 'chalk';

import path from 'path';

import { ReboostInstance } from './index';
import { diff, getTimestamp } from './utils';
import { messageClient } from './proxy-server';

export const createWatcher = (instance: ReboostInstance) => {
  const { watchOptions } = instance.config;
  const watcher = new FSWatcher(watchOptions.chokidar);
  const dependenciesMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();

  instance.onStop("Closes proxy server's file watcher", () => watcher.close());

  const formatPath = (filePath: string) => path.relative(instance.config.rootDir, filePath).replace(/\\/g, '/');

  watcher.on('change', (filePath) => {
    filePath = path.normalize(filePath);
    
    instance.log('info', chalk.blue(`${getTimestamp()} Changed: ${formatPath(filePath)}`));
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
    
    instance.log('info', chalk.blue(`${getTimestamp()} Deleted: ${formatPath(filePath)}`));
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
            instance.log('watchList', chalk.blue(`Watching ${formatPath(dependency)}`));
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
            instance.log('watchList', chalk.blue(`Unwatched ${formatPath(dependency)}`));
            return;
          }
          dependentsMap.set(dependency, filtered);
        });

        dependenciesMap.set(file, dependenciesCopy);
      }
    }
  }
}
