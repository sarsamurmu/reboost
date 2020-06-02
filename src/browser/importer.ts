export interface Importer {
  All(mod: any): any;
  Default(mod: any, sourcePath: string): any;
  Dynamic(toImport: string): any;
  Member(mod: any, member: string, sourcePath: string): any;
}

declare const address: string;
declare const filePath: string;

const importer: Importer = {
  All(mod) {
    if (mod.__cjsModule) return mod.default;
    return mod;
  },
  Default(mod, sourcePath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "default". Module imported by "${filePath}"`;

    if (mod.__cjsModule && mod.default.__esModule) {
      if (!('default' in mod.default)) throw new SyntaxError(message);
      return mod.default.default;
    }
    if (!('default' in mod)) throw new SyntaxError(message);
    return mod.default;
  },
  async Dynamic(toImport) {
    const response = await fetch(`${address}/resolve?from=${filePath}&to=${toImport}`);
    if (!response.ok) {
      throw new TypeError(`[reboost] Failed to resolve dynamically imported module "${toImport}"`);
    }
    const resolvedPath = await response.text();
    return importer.All(await import(`${address}/transformed?q=${encodeURI(resolvedPath)}&importer=${encodeURI(filePath)}`));
  },
  Member(mod, member, sourcePath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "${member}". Module imported by "${filePath}"`;

    if (mod.__cjsModule) {
      if (!(member in mod.default)) throw new SyntaxError(message);
      return mod.default[member];
    }
    if (!(member in mod)) throw new SyntaxError(message);
    return mod[member];
  }
}

export default importer;
