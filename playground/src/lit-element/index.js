import { LitElement, customElement, css, html } from 'lit-element';
import { queryAsync } from 'lit-element/lib/decorators';

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
      <span class="main">Lit Element</span>
    `
  }
}
