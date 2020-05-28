import anymatch, { Matcher } from 'anymatch';

import { ReboostPlugin } from '../index';
import { bind } from '../utils';

interface UsePluginOptions {
  test: Matcher;
  use: ReboostPlugin[];
}

export const UsePlugin = (options: UsePluginOptions): Required<ReboostPlugin> => {
  const test = (string: string) => anymatch(options.test, string);
  const def = (a: any) => !!a;
  const getHooks = <T extends keyof ReboostPlugin>(hookName: T): ReboostPlugin[T][] => {
    return options.use.map( (plugin) => plugin[hookName] ).filter(def);
  }

  return {
    name: 'core-use-plugin',
    async setup(data) {
      for (const hook of getHooks('setup')) await hook(data);
    },
    async resolve(pathToResolve, relativeTo) {
      if (test(relativeTo)) {
        for (const hook of getHooks('resolve')) {
          const result = await hook(pathToResolve, relativeTo);
          if (result) return result;
        }
      }

      return null;
    },
    async load(filePath) {
      if (test(filePath)) {
        for (const hook of getHooks('load')) {
          const result = await bind(hook, this)(filePath);
          if (result) return result;
        }
      }

      return null;
    },
    async transformContent(data, filePath) {
      if (test(filePath)) {
        for (const hook of getHooks('transformContent')) {
          const result = await bind(hook, this)(data, filePath);
          if (result) return result;
        }
      }

      return null;
    },
    async transformIntoJS(data, filePath) {
      if (test(filePath)) {
        for (const hook of getHooks('transformIntoJS')) {
          const result = await bind(hook, this)(data, filePath);
          if (result) return result;
        }
      }

      return null;
    },
    async transformAST(ast, babel, filePath) {
      if (test(filePath)) {
        for (const hook of getHooks('transformAST')) {
          bind(hook, this)(ast, babel, filePath);
        }
      }
    }
  }
}
