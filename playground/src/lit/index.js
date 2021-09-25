import { LitElement, css, html } from 'lit';
import { customElement, queryAsync } from 'lit/decorators.js';

import style from './styles.lit.css';

@customElement('my-element')
export class MyElement extends LitElement {
  @queryAsync('#main')
  main

  static get styles() {
    return [style];
  }

  render() {
    return html`
      <span class="main">Lit is here!</span>
    `
  }
}
