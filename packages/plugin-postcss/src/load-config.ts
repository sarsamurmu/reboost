// @ts-expect-error No declaration needed
import _loadConfig from 'postcss-load-config';

export interface LoadConfigResult {
  plugins: import('postcss').Plugin[];
  options: import('postcss').ProcessOptions;
  file: string;
}

export const loadConfig: (
  ctx: Record<string, any>,
  startPath: string,
  options: Record<string, any>
) => Promise<LoadConfigResult> = _loadConfig;
