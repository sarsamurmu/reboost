export interface Importer {
  Default(mod: any, sourcePath: string): any;
  Member(mod: any, member: string, sourcePath: string): any;
  All(mod: any): any;
}

declare const filePath: string;

export default {
  Default(mod, sourcePath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "default". Module imported by "${filePath}"`;

    if (mod.__cjsModule && mod.default.__esModule) {
      if (!('default' in mod.default)) throw new SyntaxError(message);
      return mod.default.default;
    }
    if (!('default' in mod)) throw new SyntaxError(message);
    return mod.default;
  },
  Member(mod, member, sourcePath) {
    const message = `The requested module "${sourcePath}" does not provide an export named "${member}". Module imported by "${filePath}"`;

    if (mod.__cjsModule) {
      if (!(member in mod.default)) throw new SyntaxError(message);
      return mod.default[member];
    }
    if (!(member in mod)) throw new SyntaxError(message);
    return mod[member];
  },
  All(mod) {
    if (mod.__cjsModule) return mod.default;
    return mod;
  }
} as Importer;
