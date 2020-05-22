import { JSONLoaderPlugin } from './json-loader';
import { LoaderPlugin } from './loader';
import { ResolverPlugin } from './resolver';
import { CommonJSPlugin } from './commonjs';
import { CommonJSInteropPlugin } from './commonjs-interop';

export const defaultPlugins = [
  JSONLoaderPlugin,
  LoaderPlugin,
  ResolverPlugin,
  CommonJSPlugin,
  CommonJSInteropPlugin
]
