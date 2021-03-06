import { add } from './add';
import json from './jsonFile.json';
import * as cMod from './common.cjs';
import './hot-reload';
import { render } from './render';
import { count, incCount } from './counter';

console.log('Add', add(5, 5));
cMod.isSupported();
console.log('JSON is', json);
// console.log('Replaced strings are', ADJECTIVE);
console.log('Import meta', import.meta);

const subtractModulePath = './subtract';
import(subtractModulePath).then(({ subtract }) => {
  console.log('Subtract', subtract(5, 5));
});

console.log('Count', count);
console.log('Increased count', incCount());
console.log('Count', count);

console.log(Object.keys(import.meta.hot));

render();

export { add }
