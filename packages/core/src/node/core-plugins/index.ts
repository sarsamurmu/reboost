import { JSONPlugin } from './json';
import { LoaderPlugin } from './loader';
import { ResolverPlugin } from './resolver';
import { NodeEnvPlugin } from './node-env';
import { CommonJSMode1Plugin } from './commonjs-mode-1/';
import { CommonJSMode2Plugin } from './commonjs-mode-2/';

import { ReboostInstance, ReboostPlugin } from '../index';

export const CorePlugins = (instance: ReboostInstance): ReboostPlugin[] => {
  const plugins = [
    JSONPlugin(),
    LoaderPlugin(),
    ResolverPlugin(instance),
    NodeEnvPlugin(instance)
  ];

  if (instance.config.commonJSInterop.mode > 0) {
    plugins.push(
      instance.config.commonJSInterop.mode === 1
        ? CommonJSMode1Plugin()
        : CommonJSMode2Plugin(instance)
    )
  }

  return plugins;
}
