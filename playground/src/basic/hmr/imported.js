import { hot } from 'reboost/hmr';

exports.state = 20;

if (hot.data) {
  console.log('Has data', hot.data);
}
