// @ts-check
import RefreshRuntime from 'react-refresh/runtime';

/* global self */

/** @type any */
const aSelf = self;

RefreshRuntime.injectIntoGlobalHook(aSelf);

aSelf.$RefreshReg$ = () => {/* Nothing */ };
aSelf.$RefreshSig$ = () => (type) => type;

// Modified from -
// https://github.com/facebook/metro/blob/febdba2383113c88296c61e28e4ef6a7f4939fda/packages/metro/src/lib/polyfills/require.js#L748-L774
/** @param {Record<string, any>} moduleExports */
export const isReactRefreshBoundary = (moduleExports) => {
  if (RefreshRuntime.isLikelyComponentType(moduleExports)) {
    return true;
  }

  let hasExports = false;
  let areAllExportsComponents = true;

  for (const key in moduleExports) {
    hasExports = true;
    const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
    if (desc && desc.get) return false;
    const exportValue = moduleExports[key];
    if (!RefreshRuntime.isLikelyComponentType(exportValue)) {
      areAllExportsComponents = false;
    }
  }

  return hasExports && areAllExportsComponents;
}

export const createSignatureFunction = RefreshRuntime.createSignatureFunctionForTransform;
export const register = RefreshRuntime.register;
export const performReactRefresh = RefreshRuntime.performReactRefresh;
