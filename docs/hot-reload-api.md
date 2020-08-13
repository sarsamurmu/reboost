# Hot Reload API
### Self-accepting modules
```js
import { setName } from './some-util';
import { hot } from 'reboost/hot';

export const name = 'Some name';

setName(name);

if (hot) { // Code will be stripped out when bundled using bundler
  hot.self.accept((updatedMod) => {
    // Called when the module itself updates
    // `updatedMod` is the updated instance of the module

    // Do some updates
    setName(updatedMod.name);
  });

  hot.self.dispose((data) => {
    // Called before hot.self.accept
    // You can do cleanups here
    // Assign properties to the `data` to pass the data to the
    // module which being updated
  });
}
```

### Accepting other modules
```js
import { name } from './some-module'; // Actual code may differ, this is just an example
import { setName, resetName } from './another-module';
import { hot } from 'reboost/hot';

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

### Declining Hot Reload updates
```js
import { hot } from 'reboost/hot';

if (hot) {
  // `hot.decline` marks this module as not Hot Reload-able
  // Even if another module accepts this module, it will not trigger any
  // Hot Reload updates. Whenever this module is updated (doing modification and saving it)
  // it will do a full page reload no matter what

  // Declining the module itself
  hot.self.decline();

  // Declining other modules
  hot.decline('./someDep.js');
}
```

### Canceling ongoing Hot Reload update
```js
import { hot } from 'reboost/hot';

if (hot) {
  hot.self.accept(() => {
    // You can cancel an ongoing Hot Reload update by calling `hot.invalidate`
    // You can use it to cancel updates conditionally
    if (someCondition) {
      hot.invalidate();
    }
  });
}
```

### Passing data to the module which is being updated
```js
// main.js
import any from 'dep.js';
import { hot } from 'reboost/hot';

if (hot) {
  hot.dispose('./dep.js', (data) => {
    // Add properties to the `data` object, it will be passed to the module
    // which is being updated (in this case, using the `dispose` function)
    data.VALUE = 'Hi, there';
  });
}

// dep.js
import { hot } from 'reboost/hot';

if (hot) {
  console.log(hot.data);
  /*
    `hot.data` would be undefined when this module (`dep.js`) is being imported for the first time

    But when this module is accepted by any module and updated using Hot Reload
    `hot.data` would be the data which is passed from the `dispose` function
    in our case `hot.data` would be `{ VALUE: 'Hi, there' }`
   */
}
```

### Getting ID of a module
```js
import { hot } from 'reboost/hot';

if (hot) {
  hot.id // ID of the module where `hot` is imported
  // You can use it as a key to store module specific data
  // on some global object
}
```

### Using a custom reload mechanism
```js
// By default, Reboost uses the native `location.reload` function
// to reload the page. But you can change it by assigning `reload` property
// to the `Reboost` object of global `self` object
self.Reboost.reload = () => {
  // Do your things to reload the page
}
```
