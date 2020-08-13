import { hot } from 'reboost/hot';

exports.state = 20;

if (hot.data) {
  console.log('Has data', hot.data);
}
