export interface Importer {
  All(mod: any): any;
  Default(mod: any, sourcePath: string, importerPath: string): any;
  Dynamic(toImport: string, importerPath: string): any;
  Member(mod: any, member: string, sourcePath: string, importerPath: string): any;
}

declare const address: string;
declare const commonJSInteropMode: number;

const importer: Importer = {
  All(mod) {
    if (commonJSInteropMode === 1 && mod.__cjsExports) return mod.__cjsExports;
    return mod;
  },
  Default(mod, sourcePath, importerPath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "default". Module is imported by "${importerPath}"`;

    if (mod.__cjsExports) {
      if (mod.__cjsExports.__esModule) {
        if (!('default' in mod.__cjsExports)) throw new SyntaxError(message);
        return mod.__cjsExports.default;
      }
      return mod.__cjsExports;
    }
    if (!('default' in mod)) throw new SyntaxError(message);
    return mod.default;
  },
  async Dynamic(toImport, importerPath) {
    const response = await fetch(`${address}/resolve?from=${encodeURIComponent(importerPath)}&to=${encodeURIComponent(toImport)}`);
    if (!response.ok) {
      throw new TypeError(`[reboost] Failed to resolve dynamically imported module "${toImport}"`);
    }
    const resolvedPath = await response.text();
    return importer.All(await import(`${address}/transformed?q=${encodeURIComponent(resolvedPath)}`));
  },
  Member(mod, member, sourcePath, importerPath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "${member}". Module is imported by "${importerPath}"`;

    if (mod.__cjsExports) {
      if (!(member in mod.__cjsExports)) throw new SyntaxError(message);
      return mod.__cjsExports[member];
    }
    if (!(member in mod)) throw new SyntaxError(message);
    return mod[member];
  }
}

export default importer;
