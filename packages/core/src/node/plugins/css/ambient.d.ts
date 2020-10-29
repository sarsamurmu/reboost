declare module 'postcss-modules-local-by-default' {
  type Modes = 'global' | 'local' | 'pure';
  function main(options: {
    mode: Modes;
  }): import('postcss').Plugin;
  export = main;
}

declare module 'postcss-modules-extract-imports' {
  function main(): import('postcss').Plugin;
  export = main;
}

declare module 'postcss-modules-values' {
  function main(): import('postcss').Plugin;
  export = main;
}

declare module 'postcss-modules-scope' {
  function main(options: {
    generateScopedName?: (rawName: string, from: string, css: string) => string;
    generateExportEntry?: (rawName: string, scopedName: string, from: string, css: string) => { key: string, value: string }
    exportGlobals?: boolean;
  }): import('postcss').Plugin;
  export = main;
}

declare module 'icss-utils' {
  interface ExtractedICSS {
    icssImports: Record<string, Record<string, string>>;
    icssExports: Record<string, string>;
  }
  function extractICSS(css: import('postcss').Root, removeRules?: boolean): ExtractedICSS;
  export { extractICSS, ExtractedICSS }
}
