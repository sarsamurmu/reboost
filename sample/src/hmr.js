import * as common from './common';
import { hot } from 'reboost/hmr';

if (hot) {
  hot.accept('./common', (mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.dispose('./common', (data) => {
    console.log('Disposing hot');
    data.value = 'some value';
  });
}
