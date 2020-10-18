declare module 'postcss-load-config' {
  interface LoadConfigResult {
    plugins: import('postcss').Plugin[];
    options: import('postcss').ProcessOptions;
    file: string;
  }
  function main(ctx: Record<string, any>, startPath: string, options: Record<string, any>): Promise<LoadConfigResult>;
  export = main;
}
