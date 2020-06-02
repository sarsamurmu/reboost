# HMR API
### Self-accepting modules
```js
import { hot } from 'reboost/hmr';

export let someExport = 10;

if (hot) { // Code will be stripped out when bundled using bundler
  hot.self.accept((updatedMod) => {
    // Called when this module updates
    // `updatedMod` is the updated instance of the module
    // Do some updates
    someExport = updatedMod.someExport;
  });

  hot.self.dispose(() => {
    // Called before hot.selfAccept
    // You can do cleanups here
  });
}
```

### Accepting other modules
```js
import { name } from './some-module'; // Actual code may differ, this is just an example
import { setName, resetName } from './another-module';
import { hot } from 'reboost/hmr';

setName(name);

if (hot) {
  hot.accept('./some-module', (updatedMod) => {
    // Called when `./some-module` updates
    // `updatedMod` is the updated instance of the module
    // Do some updates
    setName(updatedMod.name);
  });

  hot.dispose('./some-module', () => {
    // Called before `hot.accept` function
    // You can do cleanups here, like so
    resetName();
  });
}
```

### Passing data to the module which is being updated
```js
// main.js
import any from 'dep.js';
import { hot } from 'reboost/hmr';

if (hot) {
  hot.dispose('./dep.js', (data) => {
    // Add properties to the `data` object, it will be passed to the module
    // which we accepted (in this case, using the `dispose` function)
    data.VALUE = 'Hi, there';
  });
}

// dep.js
import { hot } from 'reboost/hmr';

if (hot) {
  console.log(hot.data);
  /*
    `hot.data` would be undefined when this module (`dep.js`) is being imported for the first time
   */
  /*
    But when this module is accepted by any module and updated by HMR
    `hot.data` would be the data which is passed from the `dispose` function
    in our case `hot.data` would be `{ VALUE: 'Hi, there' }`
   */
}
```

### Getting ID of a module
```js
import { hot } from 'reboost/hmr';

if (hot) {
  hot.id // ID of the module where `hot` is imported
  // You can use it as key to store module specific data
}
```
