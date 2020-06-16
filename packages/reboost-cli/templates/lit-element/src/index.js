import { LitElement, customElement, css, html } from 'lit-element';

@customElement('my-element')
export class MyElement extends LitElement {
  static get styles() {
    return css`
      .background {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background-image: url("https://source.unsplash.com/300x0/?nature,leaf");
        background-position: center;
        background-size: cover;
        z-index: -1;
        transform: scale(1.2);
        filter: brightness(0.6) blur(7px);
        background-color: #2a2938;
      }

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
      }

      .photo-credit {
        position: fixed;
        bottom: 0;
        font-size: 1.2rem;
      }

      .photo-credit a {
        color: white;
        text-decoration: none;
        border-bottom-style: solid;
        border-width: 2px;
      }
    `
  }

  render() {
    return html`
      <div class="background"></div>
      <div class="main">
        <p>
          Get started by editing <code>src/index.js</code>
        </p>
        <p class="photo-credit">
          Photo from
          <a href="https://unsplash.com">Unsplash</a>
        </p>
      </div>
    `
  }
}
