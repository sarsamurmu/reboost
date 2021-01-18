import { h, render } from 'preact';
import { App } from './App';

const appContainer = document.createElement('div');
document.body.appendChild(appContainer);

render(<App />, appContainer);
