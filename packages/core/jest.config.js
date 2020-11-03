/** @type import('@jest/types').Config.InitialOptions */
module.exports = {
  roots: ['__tests__'],
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: ['dist/node/**/*.js'],
  moduleNameMapper: {
    '^src-node/(.*)$': '<rootDir>/dist/node/$1'
  },
  snapshotResolver: '<rootDir>/tests-src/snapshotResolver.js',
  testEnvironment: '<rootDir>/tests-src/testEnvironment.js',
  testTimeout: 15000,
  slowTestThreshold: 10
}
