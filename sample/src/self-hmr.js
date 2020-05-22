import { hot } from 'reboost/hmr';

export let state = 15;

if (hot) {
  hot.selfAccept((mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.selfDispose(() => {
    console.log('Disposing hot');
  });
}
