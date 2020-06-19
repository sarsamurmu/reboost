import { ReboostPlugin } from '../index';

export const ReplacePlugin = (replacements: Record<string, string>): ReboostPlugin => {
  return {
    name: 'core-replace-plugin',
    transformContent({ code: sourceCode }) {
      if (Object.keys(replacements).some((string) => sourceCode.indexOf(string) !== -1)) {
        const magicString = new this.MagicString(sourceCode);

        for (const toReplace in replacements) {
          const toReplaceWith = replacements[toReplace];
          const length = toReplace.length;
          let index = sourceCode.indexOf(toReplace);

          while (index !== -1) {
            magicString.overwrite(index, index + length, toReplaceWith);
            index = sourceCode.indexOf(toReplace, index + 1);
          }
        }

        return {
          code: magicString.toString(),
          map: magicString.generateMap()
        }
      }
    }
  }
}
