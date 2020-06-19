import { JSONPlugin } from './json';
import { LoaderPlugin } from './loader';
import { ResolverPlugin } from './resolver';
import { CommonJSPlugin } from './commonjs';
import { CommonJSInteropPlugin } from './commonjs-interop';

export const CorePlugins = [
  JSONPlugin,
  LoaderPlugin,
  ResolverPlugin,
  CommonJSPlugin,
  CommonJSInteropPlugin
]
