import anymatch, { Matcher } from 'anymatch';
import chalk from 'chalk';

import { ReboostPlugin } from '../index';
import { bind } from '../utils';

declare namespace UsePlugin {
  export interface Options {
    include: Matcher;
    exclude?: Matcher;
    use: ReboostPlugin | ReboostPlugin[] | ReboostPlugin[][];
  }
}

const createPlugin = (options: UsePlugin.Options): Required<Omit<ReboostPlugin, 'getId'>> => {
  // TODO: Remove `options.test` in v1.0
  const aOpt = options as any;
  if (aOpt.test) {
    if (!options.include) options.include = aOpt.test;
    let message = 'UsePlugin: options.test is deprecated and will be removed in next major release. ';
    message += 'Use options.include instead.';
    console.log(chalk.yellow(message));
  }

  const test = (string: string) => (
    anymatch(options.include, string) &&
    (options.exclude ? !anymatch(options.exclude, string) : true)
  );
  const plugins: ReboostPlugin[] = [];
  const getHooks = <T extends keyof ReboostPlugin>(hookName: T): ReboostPlugin[T][] => (
    plugins.map((plugin) => plugin[hookName]).filter((hook) => typeof hook === 'function')
  );

  if (Array.isArray(options.use)) {
    options.use.forEach((plugin: ReboostPlugin | ReboostPlugin[]) => {
      plugins.push(...(Array.isArray(plugin) ? plugin : [plugin]))
    });
  } else {
    plugins.push(options.use);
  }

  const setupHooks = getHooks('setup');
  const stopHooks = getHooks('stop');
  const resolveHooks = getHooks('resolve');
  const loadHooks = getHooks('load');
  const transformContentHooks = getHooks('transformContent');
  const transformIntoJSHooks = getHooks('transformIntoJS');
  const transformJSContent = getHooks('transformJSContent');
  const transformASTHooks = getHooks('transformAST');

  return {
    name: 'core-use-plugin',
    async setup(data) {
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
