import puppeteer from 'puppeteer';

declare const __BROWSER__: puppeteer.Browser;
let autoClosePages: puppeteer.Page[] = [];

export const newPage = async (autoClose = true) => {
  const page = await __BROWSER__.newPage();
  page
    .on('pageerror', ({ message }) => console.log('PAGE ERROR', message))
    .on('requestfailed', (request) => console.log([
      'REQUEST FAIL',
      `TEST NAME: ${expect.getState().currentTestName}`,
      `URL: ${request.url()}`,
      `ERROR MESSAGE: ${request.failure().errorText}`
    ].join('\n')));

  if (autoClose) autoClosePages.push(page);
  return page;
}

export const closePages = async () => {
  await Promise.all((await __BROWSER__.pages()).map((page, i) => i > 0 && page.close()));
}

afterEach(async () => {
  if (autoClosePages.length === 0) return;
  const pPages = autoClosePages;
  autoClosePages = [];
  await Promise.all(pPages.map((page) => page.close()));
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
