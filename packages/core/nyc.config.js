const baseConfig = require('../../nyc.config');

module.exports = {
  ...baseConfig,
  include: ['dist/node/**/*.js']
}
