import puppeteer from 'puppeteer';

let browser: puppeteer.Browser;
let pages: puppeteer.Page[] = [];

const debug = false;
export const newPage = async (autoClose = true) => {
  if (!browser) browser = await puppeteer.launch(debug ? {
    headless: false,
    devtools: true,
    slowMo: 1000,
  } : {});

  const page = (await browser.newPage())
    .on('pageerror', ({ message }) => console.log('PAGE ERROR', message))
    .on('requestfailed', (request) => console.log([
      'REQUEST FAIL',
      `TEST NAME: ${expect.getState().currentTestName}`,
      `URL: ${request.url()}`,
      `ERROR MESSAGE: ${request.failure().errorText}`,
      `STATUS: ${request.response().status}`
    ].join('\n')));

  if (autoClose) pages.push(page);
  return page;
}

export const closePages = async () => {
  await Promise.all((await browser.pages()).map((page, i) => i > 0 && page.close()));
}

afterEach(async () => {
  await Promise.all(pages.map((page) => page.close()));
  pages = [];
});

afterAll(async () => {
  if (browser) await browser.close();
  browser = null;
});

export const waitForConsole = (
  page: puppeteer.Page,
  test: string | ((msg: puppeteer.ConsoleMessage) => boolean),
  timeout = 8000
) => {
  let reject: (reason: any) => void;
  let resolve: () => void;
  const listener = (msg: puppeteer.ConsoleMessage) => {
    if (
      typeof test === 'function' ? test(msg) : msg.text() === test
    ) {
      resolve();
      page.off('console', listener);
    }
  }

  setTimeout(() => reject(`Waiter exceeded timeout limit of ${timeout}`), timeout);

  return new Promise((res, rej) => {
    resolve = res;
    reject = rej;
    page.on('console', listener);
  });
}
