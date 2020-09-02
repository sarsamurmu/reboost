import puppeteer from 'puppeteer';

let browser: puppeteer.Browser;
let pages: puppeteer.Page[] = [];

export const newPage = async (autoClose = true) => {
  if (!browser) browser = await puppeteer.launch({ dumpio: true });
  const page = await browser.newPage();

  page
    .on('pageerror', ({ message }) => console.log('PAGE ERR', message))
    .on('requestfailed', (request) => console.log('REQUEST FAIL', request.failure().errorText, request.url()));
  
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

  setTimeout(() => reject('Waiter exceeded timeout limit'), timeout);

  return new Promise((res, rej) => {
    resolve = res;
    reject = rej;
    page.on('console', listener);
  });
}
