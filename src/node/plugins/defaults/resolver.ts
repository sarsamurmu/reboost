import fs from 'fs';
import path from 'path';

import { ReboostPlugin, ReboostConfig } from '../../index';
import { getConfig } from '../../shared';
import { isDir } from '../../utils';

const resolveExt = (fPath: string, extensions: string[]) => {
  for (const ext of extensions) {
    if (fs.existsSync(fPath + ext)) return ext;
  }
  return null;
}

const baseResolve = (fPath: string, resolveOptions: ReboostConfig['resolve']) => {
  if (fs.existsSync(fPath) && isDir(fPath)) {
    for (const mainFile of resolveOptions.mainFiles) {
      const dirPath = path.join(fPath, mainFile);
      const ext = resolveExt(dirPath, resolveOptions.extensions);
      if (ext) return dirPath + ext;
    }
  }

  const ext = resolveExt(fPath, resolveOptions.extensions);
  if (ext) return fPath + ext;

  if (fs.existsSync(fPath) && !isDir(fPath)) return fPath;

  return null;
}

export const resolveModule = (
  basePath: string,
  pathToResolve: string,
  overrides?: ReboostConfig['resolve']
) => {
  const config = getConfig();
  const { rootDir } = config;
  const resolveOptions = overrides ? Object.assign({}, config.resolve, overrides) : config.resolve;
  
  if (path.isAbsolute(pathToResolve)) return pathToResolve;

  if (pathToResolve.startsWith('.')) {
    return baseResolve(path.join(path.dirname(basePath), pathToResolve), resolveOptions);
  }

  const [firstPart, ...restPart] = pathToResolve.split('/').filter((s) => s !== '');

  if (firstPart in resolveOptions.alias) {
    const aliasPath = resolveOptions.alias[firstPart];
    return baseResolve(path.join(rootDir, aliasPath, ...restPart), resolveOptions);
  } else {
    // Check in resolve.modules directories

    for (const modulesDirName of resolveOptions.modules) {
      const modulesDirPath = path.join(rootDir, modulesDirName);

      if (fs.existsSync(modulesDirPath)) {
        const moduleName = firstPart;
        let moduleDirPath = path.join(modulesDirPath, moduleName);

        if (moduleName.startsWith('@')) {
          // Using scoped package
          moduleDirPath = path.join(modulesDirPath, moduleName, restPart.shift());
        }

        if (restPart.length !== 0) {
          // Using subdirectories
          return baseResolve(path.join(moduleDirPath, ...restPart), resolveOptions);
        } else {
          // Get from package.json
          const pkgJSONPath = path.join(moduleDirPath, 'package.json');
          if (fs.existsSync(pkgJSONPath)) {
            const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
            for (const field of resolveOptions.mainFields) {
              if (pkgJSON[field]) return path.join(moduleDirPath, pkgJSON[field]);
            }
          }

          const indexJSPath = path.join(moduleDirPath, 'index.js');
          if (fs.existsSync(indexJSPath)) return indexJSPath;
        }
      }
    }
  }

  return null;
}

export const ResolverPlugin: ReboostPlugin = {
  name: 'core-resolver-plugin',
  resolve(importPath, importer) {
    if (importPath.startsWith('#/')) return importPath;
    return resolveModule(importer, importPath);
  }
}
