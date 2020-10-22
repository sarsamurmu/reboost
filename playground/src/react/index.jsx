import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './App';

const appContainer = document.createElement('div');
document.body.appendChild(appContainer);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  appContainer
);
