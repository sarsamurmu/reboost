import { add } from './add';
import json from './jsonFile.json';
import * as cMod from './common';
import './hmr';
import { render } from './render';
import { createUploadLink } from 'apollo-upload-client';
import 'firebase/app';

window.fx = createUploadLink;

console.log('Add', add(5, 5));
cMod.isSupported();
console.log('JSON is', json);
console.log('Replaced strings are', ADJECTIVE);

import('./subtract').then(({ subtract }) => {
  console.log('Subtract', subtract(5, 5));
});

render();

export { add }
