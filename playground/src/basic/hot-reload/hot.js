import './imported';
import { hot } from 'reboost/hot';

if (hot) {
  hot.accept('./imported.js', (mod) => {
    console.log(`New module's state is`, mod.state);
  });
  hot.dispose('./imported.js', (data) => {
    console.log('Disposing hot');
    data.value = 'some value';
  });
  // hot.self.accept(() => {
  //   console.log('Self accepted triggered');
  // });
}
