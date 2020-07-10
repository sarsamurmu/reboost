import React, { useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import styles from './styles/index.module.css';
import JSLogo from './assets/js-logo.png';
import './styles/base.css';
import './styles/scss/index.scss';

const app = document.createElement('div');
document.body.appendChild(app);

console.log(styles);

ReactDOM.render(
  <div>
    <div className={styles.card}>
      <h3>Reboost</h3>
      <p>Making web development fast</p>
    </div>
    <br />
    <br />
    <p className={styles.builtWith}>
      Built with
      <img src={JSLogo} />
    </p>
  </div>,
  app
);
