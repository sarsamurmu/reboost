// @ts-check

module.exports = {
  testPathForConsistencyCheck: 'dir/__tests__/example.test.js',
  /**
   * @param {string} testPath
   * @param {string} snapshotExtension
   * @return {string}
   */
  resolveSnapshotPath: (testPath, snapshotExtension) => (
    testPath.replace('__tests__', 'tests-src') + snapshotExtension
  ),
  /**
   * @param {string} snapshotPath
   * @param {string} snapshotExtension
   * @return {string}
   */
  resolveTestPath: (snapshotPath, snapshotExtension) => (
    snapshotPath.replace('tests-src', '__tests__').slice(0, -snapshotExtension.length)
  )
}
