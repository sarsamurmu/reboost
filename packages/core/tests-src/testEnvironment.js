const NodeEnvironment = require('jest-environment-node');

module.exports = class PuppeteerEnvironment extends NodeEnvironment {
  constructor(...args) {
    super(...args);
  }

  async setup() {
    await super.setup();
    this.global.__BROWSER__ = global.__BROWSER__;
  }

  async teardown() {
    await super.teardown();
    this.global.__BROWSER__ = undefined;
  }
}
