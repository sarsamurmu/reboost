import * as common from './common';
import { hot } from 'reboost/hmr';

if (hot) {
  hot.accept('./common', (mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.dispose('./common', () => {
    console.log('Disposing hot');
  });
}
