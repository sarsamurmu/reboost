import './imported.cjs';
import { hot } from 'reboost/hot';

if (hot) {
  hot.accept('./imported.cjs', (mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.dispose('./imported.cjs', (data) => {
    console.log('Disposing hot');
    data.value = 'some value';
  });
  // hot.self.accept(() => {
  //   console.log('Self accepted triggered');
  // });
}
