import { hot } from 'reboost/hmr';

exports.state = 27;

if (hot.data) {
  console.log('Has data', hot.data);
}
