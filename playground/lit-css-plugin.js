module.exports = () => /** @type import('reboost').ReboostPlugin */  ({
  name: 'lit-css-plugin',
  transformContent({ code, type }) {
    if (type === 'css') {
      return {
        code: `
          import { css } from 'lit-element';
          const cssString = ${JSON.stringify(code)};
          export default css\`${code.replace(/(`|\\|\${)/g, '\\$1')}\`;
          export { cssString as css }
        `,
        type: 'js'
      }
    }
  }
});
