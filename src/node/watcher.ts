import { FSWatcher } from 'chokidar';
import anymatch from 'anymatch';
import chalk from 'chalk';

import path from 'path';

import { getConfig, messageClient } from './shared';
import { diff } from './utils';

export const createWatcher = () => {
  const { watchOptions } = getConfig();
  const watcher = new FSWatcher(watchOptions.chokidar);
  const dependenciesMap = new Map<string, string[]>();
  const dependentsMap = new Map<string, string[]>();
  const log = false;

  watcher.on('change', (filePath) => {
    console.log(chalk.blue(`Changed: ${path.relative(getConfig().rootDir, filePath).replace(/\\/g, '/')}`));
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

  watcher.on('unlink', () => {
    messageClient({
      type: 'unlink'
    })
  });

  const setDependencies = (file: string, dependencies: string[]) => {
    if (
      !anymatch(watchOptions.exclude, file) && // Not excluded
      anymatch(watchOptions.include, file) // and included
    ) {
      const prevDependencies = dependenciesMap.get(file) || [];
      const dependenciesCopy = dependencies.slice(0);
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
