import { hot } from 'reboost/hmr';

exports.isSupported = () => console.log('CommonJS modules are supported');

exports.state = 27;

if (hot.data) {
  console.log('Has data', hot.data);
}
