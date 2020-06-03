import { add } from './add';
import './renderer.jsx';
import json from './jsonFile.json';
import * as cMod from './common';
import './hmr';
import './styles/base.css';

console.log('Add', add(5, 5));
cMod.isSupported();
console.log('JSON is', json);
console.log('Replaced strings are', ADJECTIVE);

import('./subtract').then(({ subtract }) => {
  console.log('Subtract', subtract(5, 5));
}).catch((e) => {
  console.log(console.dir(e));
});

export { add }
