import { ReboostPlugin } from 'reboost';

// declare namespace LitCSSPlugin {
//   export interface Options {

//   }
// }

function LitCSSPlugin(/* options: LitCSSPlugin.Options = {} */): ReboostPlugin {
  return {
    name: 'litcss-plugin',
    getCacheKey: () => 1,
    transformContent({ code, type }) {
      if (type === 'css') {
        return {
          code: /* js */`
            import { css } from 'lit-element';
            const cssString = ${JSON.stringify(code)};
            export default css(Object.assign([cssString], { raw: [cssString] }));
            export { cssString as css }
          `,
          map: undefined,
          type: 'js'
        }
      }

      return null;
    }
  }
}

export = LitCSSPlugin;
