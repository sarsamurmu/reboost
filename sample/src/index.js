import { add } from './add';
import { subtract } from './subtract';
import './sub';
import './renderer.jsx';

console.log('Add', add(5, 5));
console.log('Subtract', subtract(5, 5));
console.log('Reboost Enabled', window.reboostEnabled);

export { add, subtract }
