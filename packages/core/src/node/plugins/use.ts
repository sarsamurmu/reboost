import anymatch, { Matcher } from 'anymatch';
import chalk from 'chalk';
// @ts-expect-error No need to install declaration file
import hashSum from 'hash-sum';

import { ReboostPlugin } from '../index';
import { bind } from '../utils';

declare namespace UsePlugin {
  export interface Options {
    include: Matcher;
    exclude?: Matcher;
    use: ReboostPlugin | ReboostPlugin[] | ReboostPlugin[][];
  }
}

const createPlugin = (options: UsePlugin.Options): Required<ReboostPlugin> => {
  // TODO: Remove `options.test` in v1.0
  const aOpt = options as any;
  if (aOpt.test) {
    if (!options.include) options.include = aOpt.test;
    let message = 'UsePlugin: options.test is deprecated and will be removed in next major release. ';
    message += 'Use options.include instead.';
    console.log(chalk.yellow(message));
  }

  const plugins = Array.isArray(options.use) ? ([] as ReboostPlugin[]).concat(...options.use) : [options.use];
  const getProperties = <T extends keyof ReboostPlugin>(hookName: T, filterFn = true): ReboostPlugin[T][] => (
    plugins.map((plugin) => plugin[hookName]).filter(filterFn ? ((hook) => typeof hook === 'function') : () => true)
  );
  const test = (string: string) => (
    anymatch(options.include, string) &&
    (options.exclude ? !anymatch(options.exclude, string) : true)
  );

  const names = getProperties('name', false);
  const cacheKeyGetterHooks = getProperties('getCacheKey');
  const setupHooks = getProperties('setup');
  const stopHooks = getProperties('stop');
  const resolveHooks = getProperties('resolve');
  const loadHooks = getProperties('load');
  const transformContentHooks = getProperties('transformContent');
  const transformIntoJSHooks = getProperties('transformIntoJS');
  const transformJSContent = getProperties('transformJSContent');
  const transformASTHooks = getProperties('transformAST');

  return {
    name: 'core-use-plugin',
    getCacheKey(utils) {
      const cacheKeys = cacheKeyGetterHooks.map((getCacheKey) => getCacheKey(utils));
      return hashSum(names.join('') + '@' + cacheKeys.join(''));
    },
    async setup(data) {
      const normalizedRootDir = data.config.rootDir.replace(/[\\/]*$/, '/').replace(/\\/g, '/');
      const regex = /^(!?)(?:\.\/)(.*)/;
      const replacement = '$1' + normalizedRootDir + '$2';
      const normalizeGlob = (glob: string) => glob.replace(regex, replacement);
      const fixIfGlob = (item: any) => typeof item === 'string' ? normalizeGlob(item) : item;

      (['include', 'exclude'] as const).forEach((key) => {
        const value = options[key];
        options[key] = Array.isArray(value) ? value.map(fixIfGlob) : fixIfGlob(value);
      });

      for (const hook of setupHooks) await hook(data);
    },
    async stop() {
      for (const hook of stopHooks) await hook();
    },
    async resolve(pathToResolve, relativeTo) {
      if (test(relativeTo)) {
        for (const hook of resolveHooks) {
          const result = await hook(pathToResolve, relativeTo);
          if (result) return result;
        }
      }
    },
    async load(filePath) {
      if (test(filePath)) {
        for (const hook of loadHooks) {
          const result = await bind(hook, this)(filePath);
          if (result) return result;
        }
      }
    },
    async transformContent(data, filePath) {
      if (test(filePath)) {
        for (const hook of transformContentHooks) {
          const result = await bind(hook, this)(data, filePath);
          if (result) return result;
        }
      }
    },
    async transformIntoJS(data, filePath) {
      if (test(filePath)) {
        for (const hook of transformIntoJSHooks) {
          const result = await bind(hook, this)(data, filePath);
          if (result) return result;
        }
      }
    },
    async transformJSContent(data, filePath) {
      if (test(filePath)) {
        for (const hook of transformJSContent) {
          const result = await bind(hook, this)(data, filePath);
          if (result) return result;
        }
      }
    },
    async transformAST(ast, babel, filePath) {
      if (test(filePath)) {
        for (const hook of transformASTHooks) {
          await bind(hook, this)(ast, babel, filePath);
        }
      }
    }
  }
}

function UsePlugin(...options: UsePlugin.Options[]): ReboostPlugin[] {
  return options.map(createPlugin)
}

export { UsePlugin }
