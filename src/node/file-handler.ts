import { ParameterizedContext } from 'koa';
import { RouterParamContext } from '@koa/router';
import hash from 'md5-file';
import chalk from 'chalk';

import fs from 'fs';
import path from 'path';

import { getConfig, getFilesData, getAddress, saveFilesData, getFilesDir } from './shared';
import { ensureDir, uniqueID, diff } from './utils';
import { transformFile } from './transformer';
import { createWatcher, removeFile } from './watcher';

export const verifyFiles = () => {
  if (fs.existsSync(getFilesDir())) {
    const files = Object.keys(getFilesData().files);
    files.forEach((file) => {
      if (!fs.existsSync(file)) removeFile(file);
    });

    const dependentsData = getFilesData().dependents;
    const dependencies = Object.keys(dependentsData);
    dependencies.forEach((dependency) => {
      if (!fs.existsSync(dependency)) {
        dependentsData[dependency].forEach((file) => {
          removeFile(file);
        });
      }
    });
  }
  saveFilesData();
}

const depsChanged = async (file: string) => {
  const deps = getFilesData().files[file].dependencies;
  if (!deps) return false;
  for (const dependency in deps) {
    const prevHash = deps[dependency];
    const currentHash = await hash(dependency);
    if (prevHash !== currentHash) return true;
  }
  return false;
}

const updateDependencies = async (
  filePath: string,
  dependencies: string[],
  firstTime = false
): Promise<void> => {
  const dependentsData = getFilesData().dependents;
  const fileData = getFilesData().files[filePath];
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

  const depsData = {} as Record<string, string>;
  const promises: Promise<void>[] = [];

  dependencies.forEach((dependency) => {
    promises.push((async () => {
      depsData[dependency] = await hash(dependency);
    })());
  });

  await Promise.all(promises);

  fileData.dependencies = depsData;
}

let gitignoreCreated = false;
let watcher: ReturnType<typeof createWatcher>;

export const fileRequestHandler = async (ctx: ParameterizedContext<any, RouterParamContext<any, {}>>) => {
  const config = getConfig();
  const filesDir = getFilesDir();
  ensureDir(config.cacheDir);
  ensureDir(filesDir);

  if (!gitignoreCreated) {
    fs.writeFileSync(path.join(config.cacheDir, './.gitignore'), '/**/*');
    gitignoreCreated = true;
  }

  if (!watcher) watcher = createWatcher();

  const filePath = ctx.query.q;
  const importerPath = ctx.query.importer;
  const fileHash = await hash(filePath);
  const timerName = chalk.cyan(`Response time - ${path.relative(config.rootDir, filePath)}`);
  let transformedCode: string;

  if (config.showResponseTime) console.time(timerName);

  if (fs.existsSync(filePath)) {
    if (getFilesData().files[filePath]) {
      const fileData = getFilesData().files[filePath];
      const outputFilePath = path.join(filesDir, fileData.uid);

      if ((fileData.hash !== fileHash) || await depsChanged(filePath)) {
        let pure = true;
        const {
          code,
          map,
          imports,
          dependencies,
          error
        } = await transformFile(filePath);
        transformedCode = code;

        if (map) {
          // Remove other source maps
          transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
          transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
          fs.promises.writeFile(`${outputFilePath}.map`, map);
        }

        if (!error) {
          if (map || imports.length) pure = undefined;
          fs.promises.writeFile(outputFilePath, transformedCode);
          fileData.hash = fileHash;
          fileData.address = getAddress();
          fileData.pure = pure;
          await updateDependencies(filePath, dependencies);
          saveFilesData();
        }

        watcher.setDependencies(filePath, dependencies);
      } else {
        const pure = fileData.pure;
        const currentAddress = getAddress();
        transformedCode = fs.readFileSync(outputFilePath).toString();

        if (!pure && (fileData.address !== currentAddress)) {
          const addressRegex = new RegExp(fileData.address, 'g');
          transformedCode = transformedCode.replace(addressRegex, currentAddress);

          fs.promises.writeFile(outputFilePath, transformedCode);
          if (fs.existsSync(`${outputFilePath}.map`)) {
            const fileMap = fs.readFileSync(`${outputFilePath}.map`).toString();
            fs.promises.writeFile(`${outputFilePath}.map`, fileMap.replace(addressRegex, currentAddress));
          }

          fileData.address = currentAddress;
          saveFilesData();
        }

        watcher.setDependencies(filePath, Object.keys(fileData.dependencies || {}));
      }
    } else {
      let pure = true;
      const uid = uniqueID();
      const outputFilePath = path.join(filesDir, uid);
      const {
        code,
        map,
        imports,
        dependencies,
        error
      } = await transformFile(filePath);
      transformedCode = code;

      if (map) {
        // Remove other source maps
        transformedCode = transformedCode.replace(/\/\/#\s*sourceMappingURL=.*/g, '');
        transformedCode += `\n//# sourceMappingURL=${getAddress()}/raw?q=${encodeURI(outputFilePath)}.map`;
        fs.promises.writeFile(`${outputFilePath}.map`, map);
      }

      if (!error) {
        if (map || imports.length) pure = undefined;
        fs.promises.writeFile(outputFilePath, transformedCode);
        type fileData = ReturnType<typeof getFilesData>['files'][string];
        (getFilesData().files[filePath] as Omit<fileData, 'mergedDependencies' | 'dependencies'>) = {
          uid,
          hash: fileHash,
          address: getAddress(),
          pure
        };
        await updateDependencies(filePath, dependencies, true);
        saveFilesData();
      }

      watcher.setDependencies(filePath, dependencies);
    }
  } else {
    let message = `[reboost] The requested file does not exist: ${filePath}. `;
    message += `File is requested by ${importerPath}`;
    transformedCode = `console.error(${JSON.stringify(message)})`;
  }

  ctx.type = 'text/javascript';
  ctx.body = transformedCode;

  if (config.showResponseTime) console.timeEnd(timerName);
}
