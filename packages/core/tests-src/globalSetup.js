const puppeteer = require('puppeteer');

const debug = false;

const startBrowser = async () => {
  const browser = await puppeteer.launch(debug ? {
    headless: false,
    devtools: true,
    slowMo: 1000,
  } : {});

  browser.on('disconnected', () => {
    if (!global.__isClosingBrowser) {
      console.log('THE BROWSER HAS DISCONNECTED. RESTARTING...');
      startBrowser();
    }
  });

  global.__BROWSER__ = browser;
}

module.exports = startBrowser;
