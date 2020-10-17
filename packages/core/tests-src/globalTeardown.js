module.exports = async () => {
  global.__isClosingBrowser = true;
  await global.__BROWSER__.close();
}
