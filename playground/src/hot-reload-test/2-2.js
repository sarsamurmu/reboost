import './1';
import { hot } from 'reboost/hot';

hot.self.accept(() => {
  console.log('Self accept called by 2-2 for 1');
});
