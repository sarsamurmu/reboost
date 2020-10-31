import styles from './styles/index.module.css';
import JSLogo from './assets/js-logo.png';
import normalCSS from './styles/normal.css';
import { toString } from './styles/normal.css';

console.log(styles);
console.log(normalCSS.toString());
console.log(toString() === normalCSS.toString());

document.body.append(...new DOMParser().parseFromString(/* html */`
  <div>
    <div class="${styles.card}">
      <h3>Reboost</h3>
      <p>Making web development fast</p>
    </div>
    <br><br>
    <p class="${styles.builtWith}">
      Built with
      <img src=${JSLogo}>
    </p>
    <div class="bg-card">
      A Card
    </div>
  </div>
`, 'text/html').body.children);
