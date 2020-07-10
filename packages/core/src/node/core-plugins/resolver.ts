import fs from 'fs';
import path from 'path';

import { ReboostPlugin, ReboostConfig } from '../index';
import { getConfig } from '../shared';
import { isDir } from '../utils';

function resolveUnknown(
  toResolve: string,
  resolveOptions: ReboostConfig['resolve'],
  skippedPkgJSON = ''
): string {
  if (fs.existsSync(toResolve)) {
    if (isDir(toResolve)) return resolveDirectory(toResolve, resolveOptions, skippedPkgJSON);
    return toResolve;
  }

  const resolved = resolveExtension(toResolve, resolveOptions.extensions);
  if (resolved) return resolved;

  return null;
}

function resolveExtension(filePath: string, extensions: string[]) {
  for (const ext of extensions) {
    const finalPath = filePath + ext;
    if (fs.existsSync(finalPath)) return finalPath;
  }

  return null;
}

function resolveAlias(toResolve: string, aliases: Record<string, string>) {
  if (aliases[toResolve]) return aliases[toResolve];

  const match = toResolve.match(/^(.+?)(?:\/)/);
  const toReplace = match && match[1];
  if (toReplace && aliases[toReplace]) {
    const toReplace = match[1];
    return toResolve.replace(new RegExp(`^${toReplace}`), aliases[toReplace]);
  }

  return toResolve;
}

function resolveDirectory(
  dirPath: string,
  resolveOptions: ReboostConfig['resolve'],
  skippedPkgJSON = ''
) {
  const pkgJSONPath = path.join(dirPath, './package.json');
  if (pkgJSONPath !== skippedPkgJSON && fs.existsSync(pkgJSONPath)) {
    const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
    for (const field of resolveOptions.mainFields) {
      const fieldValue = pkgJSON[field];
      if (fieldValue) return resolveUnknown(path.join(dirPath, fieldValue), resolveOptions, skippedPkgJSON);
    }
  }

  for (const mainFile of resolveOptions.mainFiles) {
    const filePath = path.join(dirPath, mainFile);
    const resolved = resolveExtension(filePath, resolveOptions.extensions);
    if (resolved) return resolved;
  }

  return null;
}

function resolveModule(modulePath: string, resolveOptions: ReboostConfig['resolve']) {
  const { rootDir } = getConfig();
  const [firstPart, ...restPart] = modulePath.split('/').filter((s) => s !== '');

  for (const modulesDir of resolveOptions.modules) {
    const modulesDirPath = path.join(rootDir, modulesDir);

    if (fs.existsSync(modulesDirPath)) {
      const moduleName = firstPart;
      let moduleDirPath = path.join(modulesDirPath, moduleName);

      // Scooped package
      if (moduleName.startsWith('@')) {
        moduleDirPath = path.join(modulesDirPath, moduleName, restPart.shift());
      }

      return resolveUnknown(path.join(moduleDirPath, ...restPart), resolveOptions);
    }
  }

  return null;
}

export function resolve(
  basePath: string,
  pathToResolve: string,
  overrides?: ReboostConfig['resolve']
) {
  const config = getConfig();
  const resolveOptions = overrides ? Object.assign({}, config.resolve, overrides) : config.resolve;

  pathToResolve = resolveAlias(pathToResolve, resolveOptions.alias);

  if (path.isAbsolute(pathToResolve) && fs.existsSync(pathToResolve)) return pathToResolve;

  if (pathToResolve.startsWith('.')) {
    return resolveUnknown(path.join(path.dirname(basePath), pathToResolve), resolveOptions);
  }

  return resolveModule(pathToResolve, resolveOptions);
}

export const ResolverPlugin: ReboostPlugin = {
  name: 'core-resolver-plugin',
  resolve(importPath, importer) {
    if (importPath.startsWith('#/')) return importPath;
    return resolve(importer, importPath);
  }
}
