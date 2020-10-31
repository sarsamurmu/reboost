import { Plugin, Root } from 'postcss';

// @ts-expect-error No declaration found
import _localByDefault from 'postcss-modules-local-by-default';
// @ts-expect-error Same
import _extractImports from 'postcss-modules-extract-imports';
// @ts-expect-error Same
import _moduleValues from 'postcss-modules-values';
// @ts-expect-error Same
import _moduleScope from 'postcss-modules-scope';
// @ts-expect-error Same
import { extractICSS as _extractICSS } from 'icss-utils';

export type Modes = 'global' | 'local' | 'pure';
export const localByDefault: (options: {
  mode: Modes
}) => Plugin = _localByDefault;

export const extractImports: () => Plugin = _extractImports;

export const moduleValues: () => Plugin = _moduleValues;

export const moduleScope: (options: {
  generateScopedName?: (rawName: string, from: string, css: string) => string;
  generateExportEntry?: (rawName: string, scopedName: string, from: string, css: string) => { key: string, value: string }
  exportGlobals?: boolean;
}) => Plugin = _moduleScope;

export interface ExtractedICSS {
  icssImports: Record<string, Record<string, string>>;
  icssExports: Record<string, string>;
}
export const extractICSS: (
  css: Root,
  removeRules?: boolean
) => ExtractedICSS = _extractICSS;
