// @ts-check
const NodeEnvironment = require('jest-environment-node');
const puppeteer = require('puppeteer');

const debug = false;
module.exports = class PuppeteerEnvironment extends NodeEnvironment {
  async startBrowser() {
    const browser = await puppeteer.launch(debug ? {
      headless: false,
      devtools: true,
      slowMo: 1000,
    } : {});

    browser.on('disconnected', () => {
      if (!this.isClosingBrowser) {
        console.log('THE BROWSER HAS DISCONNECTED. RESTARTING...');
        this.startBrowser();
      }
    });

    this.global.__BROWSER__ = this.__BROWSER__ = browser;
  }

  async setup() {
    await super.setup();
    await this.startBrowser();
  }

  async teardown() {
    await super.teardown();
    this.global.__BROWSER__ = undefined;
    this.isClosingBrowser = true;
    this.__BROWSER__.close();
  }
}
