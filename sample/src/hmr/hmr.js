import * as imported from './imported';
import { hot } from 'reboost/hmr';

if (hot) {
  hot.accept('./imported.js', (mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.dispose('./imported.js', (data) => {
    console.log('Disposing hot');
    data.value = 'some value';
  });
}
