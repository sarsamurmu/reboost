// @ts-expect-error No need of declarations
import RefreshRuntime from 'react-refresh/runtime';

RefreshRuntime.injectIntoGlobalHook(window);

(window as any).$RefreshReg$ = () => {/* Nothing */};
(window as any).$RefreshSig$ = () => (type: any) => type;

// Modified from -
// https://github.com/facebook/metro/blob/febdba2383113c88296c61e28e4ef6a7f4939fda/packages/metro/src/lib/polyfills/require.js#L748-L774
export const isReactRefreshBoundary = (moduleExports: Record<string, any>) => {
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
