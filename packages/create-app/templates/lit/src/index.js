import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-element')
export class MyElement extends LitElement {
  static get styles() {
    return css`
      .main {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 2.2rem;
        text-align: center;
        font-family: sans-serif;
        color: white;
        background-color: #2a2938;
        padding: 20px;
      }
    `
  }

  render() {
    return html`
      <div class="background"></div>
      <div class="main">
        <p>
          Get started by editing
          <code>src/index.js</code> and <code>public/index.html</code>
        </p>
      </div>
    `
  }
}
