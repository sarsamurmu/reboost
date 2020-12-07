import { ResolverFactory, Resolver, ResolveOptions, CachedInputFileSystem } from 'enhanced-resolve';

import fs from 'fs';
import path from 'path';

import { ReboostInstance, ReboostPlugin } from '../index';

let defaultResolver: Resolver;
const defaultOpts: ResolveOptions = {
  fileSystem: new CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true
}

export type PublicResolveFn = (basePath: string, request: string, overrides?: Partial<ResolveOptions>) => string;

export const resolve = (
  instance: ReboostInstance,
  basePath: string,
  request: string,
  overrides?: Partial<ResolveOptions>
) => {
  if (!defaultResolver) {
    defaultResolver = ResolverFactory.createResolver(
      Object.assign({}, instance.config.resolve, defaultOpts)
    );
  }

  const resolver = overrides ? ResolverFactory.createResolver(
    Object.assign({}, instance.config.resolve, defaultOpts, overrides)
  ) : defaultResolver;

  return resolver.resolveSync({}, path.dirname(basePath), request) as string | null;
}

export const ResolverPlugin = (instance: ReboostInstance): ReboostPlugin => {
  const cacheMap = new Map<string, string>();

  return {
    name: 'core-resolver-plugin',
    getCacheKey: ({ serializeObject }) => serializeObject(instance.config.resolve),
    resolve(importedPath, importer) {
      const key = `${importer} -> ${importedPath}`;
      if (cacheMap.has(key)) {
        const resolvedPath = cacheMap.get(key);
        if (fs.existsSync(resolvedPath)) return resolvedPath;
      }

      try {
        const resolvedPath = resolve(instance, importer, importedPath);
        if (resolvedPath) cacheMap.set(key, resolvedPath);
        return resolvedPath;
      } catch (e) {
        const { message } = e;
        if (!/can't\s+resolve\s+.*?in\s+/i.test(message)) console.error(e.message);
      }
    }
  }
}
