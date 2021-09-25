import { ReboostPlugin } from 'reboost';

function LitCSSPlugin(): ReboostPlugin {
  return {
    name: 'litcss-plugin',
    getCacheKey: () => 1,
    transformContent({ code, type }) {
      if (type === 'css') {
        return {
          code: /* js */`
            import { css } from 'lit';
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
