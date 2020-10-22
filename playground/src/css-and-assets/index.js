import styles from './styles/index.module.css';
import JSLogo from './assets/js-logo.png';

console.log(styles);

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
  </div>
`, 'text/html').body.children);
