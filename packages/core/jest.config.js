/** @type import('@jest/types').Config.InitialOptions */
module.exports = {
  roots: ['__tests__'],
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: ['dist/node/**/*.js'],
  moduleNameMapper: {
    '^<thisPackage>(.*)$': '<rootDir>/dist/node$1'
  },
  snapshotResolver: '<rootDir>/tests/snapshotResolver.js',
  testEnvironment: '<rootDir>/tests/testEnvironment.js',
  testTimeout: 15000,
  slowTestThreshold: 10
}
