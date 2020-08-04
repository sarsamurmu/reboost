import { add } from './add';
import json from './jsonFile.json';
import * as cMod from './common';
import './hmr';
import { render } from './render';

console.log('Add', add(5, 5));
cMod.isSupported();
console.log('JSON is', json);
// console.log('Replaced strings are', ADJECTIVE);
console.log('Import meta', import.meta);

import('./subtract').then(({ subtract }) => {
  console.log('Subtract', subtract(5, 5));
});

console.log('New string 2');

render();

export { add }
