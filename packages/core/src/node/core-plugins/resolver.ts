import fs from 'fs';
import path from 'path';

import { ReboostPlugin, ReboostConfig } from '../index';
import { getConfig } from '../shared';
import { isDirectory } from '../utils';

function resolveUnknown(
  requestedPath: string,
  resolveOptions: ReboostConfig['resolve'],
  skippedPkgJSON = ''
): string {
  const aliasFieldResolved = resolveAliasFieldFromPackageJSON(requestedPath, resolveOptions);
  if (aliasFieldResolved) return aliasFieldResolved;

  if (fs.existsSync(requestedPath)) {
    if (isDirectory(requestedPath)) return resolveDirectory(requestedPath, resolveOptions, skippedPkgJSON);
    return requestedPath;
  }

  const resolved = resolveExtension(requestedPath, resolveOptions.extensions);
  if (resolved) {
    const eAliasFieldResolved = resolveAliasFieldFromPackageJSON(resolved, resolveOptions);
    return eAliasFieldResolved || resolved;
  }

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
  skippedPkgJSON: string
) {
  const pkgJSONPath = path.join(dirPath, './package.json');
  if (pkgJSONPath !== skippedPkgJSON && fs.existsSync(pkgJSONPath)) {
    const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
    for (const field of resolveOptions.mainFields) {
      const fieldValue = pkgJSON[field];
      if (fieldValue && typeof fieldValue === 'string') {
        const fullFilePath = path.join(dirPath, fieldValue);
        const aliasFieldResolved = resolveAliasField(pkgJSON, fullFilePath, dirPath, field, resolveOptions);
        if (aliasFieldResolved) return aliasFieldResolved;
        return resolveUnknown(fullFilePath, resolveOptions, pkgJSONPath);
      }
    }
  }

  for (const mainFile of resolveOptions.mainFiles) {
    const filePath = path.join(dirPath, mainFile);
    const resolved = resolveExtension(filePath, resolveOptions.extensions);
    if (resolved) return resolved;
  }

  return null;
}

function resolveAliasField(
  pkgJSON: Record<string, any>,
  requestedPath: string,
  currentDir: string,
  field: string,
  resolveOptions: ReboostConfig['resolve']
) {
  const browserFieldIndex = resolveOptions.mainFields.indexOf('browser');
  const currentFieldIndex = resolveOptions.mainFields.indexOf(field);
  const browserField: Record<string, string> = pkgJSON['browser'];
  
  if (
    browserFieldIndex > -1 &&
    (
      browserFieldIndex < currentFieldIndex ||
      currentFieldIndex === -1
    ) &&
    typeof browserField === 'object'
  ) {
    for (const key in browserField) {
      const filePath = path.join(currentDir, key);
      if (filePath === requestedPath) {
        return resolveUnknown(path.join(currentDir, browserField[key]), resolveOptions);
      }
    }
  }

  return null;
}

function resolveAliasFieldFromPackageJSON(
  requestedPath: string,
  resolveOptions: ReboostConfig['resolve']
) {
  const split = path.dirname(requestedPath).split(/[/\\]/);
  const currentSplit = [];
  
  for (const part of split) {
    currentSplit.push(part);

    const currentDir = currentSplit.join('/');
    const pkgJSONPath = path.join(currentDir, './package.json');
    if (fs.existsSync(pkgJSONPath)) {
      const pkgJSON = JSON.parse(fs.readFileSync(pkgJSONPath).toString());
      const resolved = resolveAliasField(pkgJSON, requestedPath, currentDir, '', resolveOptions);
      if (resolved) return resolved;
    }
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
  resolveOptions: ReboostConfig['resolve'],
  checkRoots = true
): string {
  const absoluteModulesDirs = resolveOptions.modules.filter((p) => path.isAbsolute(p));
  const modulesDirNames = resolveOptions.modules.filter((p) => !path.isAbsolute(p));

  for (const modulesDir of absoluteModulesDirs) {
    const resolved = resolvePackagePath(packagePath, modulesDir, resolveOptions);
    if (resolved) return resolved;
  }

  const split = basePath.split(/[/\\]/);
  while (split.length > 1) {
    split.pop();

    const currentDir = split.join('/');

    for (const moduleDirName of modulesDirNames) {
      const modulesDir = path.join(currentDir, moduleDirName);
      if (fs.existsSync(modulesDir)) {
        const resolved = resolvePackagePath(packagePath, modulesDir, resolveOptions);
        if (resolved) return resolved;
      }
    }
  }

  if (checkRoots) {
    for (const root of resolveOptions.roots) {
      // `resolveModule` algorithm is written in a way that we have
      // to pass the path with file name
      const resolved = resolveModule(path.join(root, 'file.js'), packagePath, resolveOptions, false);
      if (resolved) return resolved;
    }
  }

  return null;
}

export function resolve(
  basePath: string,
  requestedPath: string,
  overrides?: ReboostConfig['resolve']
) {
  const config = getConfig();
  const resolveOptions = overrides ? Object.assign({}, config.resolve, overrides) : config.resolve;

  requestedPath = resolveAlias(requestedPath, resolveOptions.alias);

  if (path.isAbsolute(requestedPath)) {
    const aliasFieldResolved = resolveAliasFieldFromPackageJSON(requestedPath, resolveOptions);
    if (aliasFieldResolved) return aliasFieldResolved;
    if (fs.existsSync(requestedPath)) return requestedPath;
  }

  if (requestedPath.startsWith('.')) {
    return resolveUnknown(path.join(path.dirname(basePath), requestedPath), resolveOptions);
  }

  return resolveModule(basePath, requestedPath, resolveOptions);
}

const cacheMap = new Map();

export const ResolverPlugin: ReboostPlugin = {
  name: 'core-resolver-plugin',
  resolve(importPath, importer) {
    if (importPath.startsWith('#/')) return importPath;

    const key = `${importer} -> ${importPath}`;
    if (cacheMap.has(key)) {
      const resolvedPath = cacheMap.get(key);
      if (fs.existsSync(resolvedPath)) return resolvedPath;
    }

    const resolvedPath = resolve(importer, importPath);
    if (resolvedPath) cacheMap.set(key, resolvedPath);
    return resolvedPath;
  }
}
