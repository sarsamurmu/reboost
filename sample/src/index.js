import { add } from './add';
import { subtract } from './subtract';
import cMod from './common';
import './sub';
import './renderer.jsx';
import json from './jsonFile.json';

console.log('Add', add(5, 5));
console.log('Subtract', subtract(5, 5));
console.log('Reboost Enabled', window.reboostEnabled);
cMod.isSupported();
console.log('JSON is', json);

export { add, subtract }
