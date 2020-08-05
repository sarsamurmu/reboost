import { LitElement, customElement, css, html } from 'lit-element';
import { queryAsync } from 'lit-element/lib/decorators';

@customElement('my-element')
export class MyElement extends LitElement {
  @queryAsync('#main')
  main

  static get styles() {
    return css`
      #main {
        font-family: sans-serif;
        font-size: x-large;
      }
    `
  }

  render() {
    return html`
      <div id="main">I guess it's working</div>
    `
  }
}
