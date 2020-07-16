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
      if (fieldValue) return resolveUnknown(path.join(dirPath, fieldValue), resolveOptions, pkgJSONPath);
    }
  }

  for (const mainFile of resolveOptions.mainFiles) {
    const filePath = path.join(dirPath, mainFile);
    const resolved = resolveExtension(filePath, resolveOptions.extensions);
    if (resolved) return resolved;
  }

  return null;
}

function resolvePackagePath(
  packagePath: string,
  modulesDir: string,
  resolveOptions: ReboostConfig['resolve']
) {
  const [moduleName, ...restPart] = packagePath.split(/[/\\]/).filter((s) => s !== '');
  let moduleDirPath = path.join(modulesDir, moduleName);

  // Scooped package
  if (moduleName.startsWith('@')) {
    moduleDirPath = path.join(moduleDirPath, restPart.shift());
  }

  return resolveUnknown(path.join(moduleDirPath, ...restPart), resolveOptions);
}

function resolveModule(
  basePath: string,
  packagePath: string,
  resolveOptions: ReboostConfig['resolve']
) {
  const absoluteModulesDirs = resolveOptions.modules.filter((p) => path.isAbsolute(p));
  const modulesDirNames = resolveOptions.modules.filter((p) => !path.isAbsolute(p));

  for (const modulesDir of absoluteModulesDirs) {
    const resolved = resolvePackagePath(packagePath, modulesDir, resolveOptions);
    if (resolved) return resolved;
  }

  const split = basePath.split(/[/\\]/);
  let currentDir: string;
  while (split.length > 1) {
    split.pop();

    currentDir = split.join('/');

    for (const moduleDirName of modulesDirNames) {
      const modulesDir = path.join(currentDir, moduleDirName);
      if (fs.existsSync(modulesDir)) {
        const resolved = resolvePackagePath(packagePath, modulesDir, resolveOptions);
        if (resolved) return resolved;
      }
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

  return resolveModule(basePath, pathToResolve, resolveOptions);
}

export const ResolverPlugin: ReboostPlugin = {
  name: 'core-resolver-plugin',
  resolve(importPath, importer) {
    if (importPath.startsWith('#/')) return importPath;
    return resolve(importer, importPath);
  }
}
