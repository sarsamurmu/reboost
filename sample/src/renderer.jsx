import React from 'react';
import ReactDOM from 'react-dom';

const app = document.createElement('div');
document.body.appendChild(app);

const jsx = <div></div>;

ReactDOM.render(<div>This is working as intended</div>, app);
