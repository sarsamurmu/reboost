import { ResolverFactory, Resolver, ResolveOptions, CachedInputFileSystem } from 'enhanced-resolve';

import fs from 'fs';
import path from 'path';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';

let defaultResolver: Resolver;
const defaultOpts: ResolveOptions = {
  fileSystem: new CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true
}

export const resolve = (
  basePath: string,
  request: string,
  overrides?: Partial<ResolveOptions>
) => {
  if (!defaultResolver) {
    defaultResolver = ResolverFactory.createResolver(
      Object.assign({}, getConfig().resolve, defaultOpts)
    );
  }

  const resolver = overrides ? ResolverFactory.createResolver(
    Object.assign({}, getConfig().resolve, defaultOpts, overrides)
  ) : defaultResolver;

  return resolver.resolveSync({}, path.dirname(basePath), request) as string | null;
}

export const ResolverPlugin = (): ReboostPlugin => {
  const cacheMap = new Map<string, string>();

  return {
    name: 'core-resolver-plugin',
    resolve(importedPath, importer) {
      if (importedPath.startsWith('/')) return importedPath;

      const key = `${importer} -> ${importedPath}`;
      if (cacheMap.has(key)) {
        const resolvedPath = cacheMap.get(key);
        if (fs.existsSync(resolvedPath)) return resolvedPath;
      }

      try {
        const resolvedPath = resolve(importer, importedPath);
        if (resolvedPath) cacheMap.set(key, resolvedPath);
        return resolvedPath;
      } catch (e) {
        const { message } = e;
        if (!/can't\s+resolve\s+.*?in\s+/i.test(message)) console.error(e.message);
      }
    }
  }
}
