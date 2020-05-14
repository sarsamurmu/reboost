import { html, render, h } from 'htm/preact/standalone.module';

const app = document.createElement('div');
document.body.appendChild(app);

const jsx = <div></div>;

render(<div>This is working as intended</div>, app);
