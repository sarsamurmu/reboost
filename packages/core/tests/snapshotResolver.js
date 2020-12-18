// @ts-check
const path = require('path');

module.exports = {
  testPathForConsistencyCheck: path.join('dir', '__tests__', 'build', 'unit', 'example.test.js'),
  /**
   * @param {string} testPath
   * @param {string} snapshotExtension
   * @return {string}
   */
  resolveSnapshotPath: (testPath, snapshotExtension) => (
    testPath
      .replace(/__tests__([/\\])build/, (_, $1) => `tests${$1}src`)
      .replace(/\.js$/, '') + snapshotExtension
  ),
  /**
   * @param {string} snapshotPath
   * @param {string} snapshotExtension
   * @return {string}
   */
  resolveTestPath: (snapshotPath, snapshotExtension) => (
    snapshotPath
      .replace(/tests([/\\])src/, (_, $1) => `__tests__${$1}build`)
      .slice(0, -snapshotExtension.length) + '.js'
  )
}
