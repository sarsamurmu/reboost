import { add } from './add';
import { subtract } from './subtract';
import './sub';
// import './renderer.jsx';
import json from './jsonFile.json';
import * as cMod from './common';
import './self-hmr';
import './hmr';

console.log('Add', add(5, 5));
console.log('Subtract', subtract(5, 5));
cMod.isSupported();
console.log('JSON is', json);
console.log('Replaced strings are', ADJECTIVE);

export { add, subtract }
