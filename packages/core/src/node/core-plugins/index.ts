import { JSONPlugin } from './json';
import { LoaderPlugin } from './loader';
import { ResolverPlugin } from './resolver';
import { NodeEnvPlugin } from './node-env';
import { CommonJSMode1Plugin } from './commonjs-mode-1/';
import { CommonJSMode2Plugin } from './commonjs-mode-2/';

import { ReboostPlugin } from '../index';
import { getConfig } from '../shared';

export const CorePlugins = (): ReboostPlugin[] => {
  const plugins = [
    JSONPlugin(),
    LoaderPlugin(),
    ResolverPlugin(),
    NodeEnvPlugin()
  ];

  if (getConfig().commonJSInterop.mode > 0) {
    plugins.push(
      getConfig().commonJSInterop.mode === 1
        ? CommonJSMode1Plugin()
        : CommonJSMode2Plugin()
    )
  }

  return plugins;
}
