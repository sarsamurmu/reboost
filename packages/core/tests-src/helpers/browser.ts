import puppeteer from 'puppeteer';

let browser: puppeteer.Browser;
let pages: puppeteer.Page[] = [];

export const newPage = async (autoClose = true) => {
  if (!browser) browser = await puppeteer.launch();
  const page = await browser.newPage();
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
