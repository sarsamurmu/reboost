// Workaround
// Svelte included these in its declaration file - node_modules/svelte/types/compiler/index.d.ts
// But the modules are not available because svelte did not include them as dependency

declare module 'estree' {
  export type Node = any;
  export type Program = any;
}

declare module 'estree-walker' {
  export const walk: any;
}
