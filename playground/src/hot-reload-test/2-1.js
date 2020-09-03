import './1';
import { hot } from 'reboost/hot';

hot.accept('./1', () => {
  console.log('Accept called by 2-1 for 1');
});
