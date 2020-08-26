module.exports = {
  roots: ['__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  testEnvironment: 'node',
  coverageReporters: [
    'lcov', 'text-summary'
  ],
  collectCoverageFrom: [
    'dist/node/**/*.js'
  ],
  moduleNameMapper: {
    '^src-node/(.*)$': '<rootDir>/dist/node/$1'
  },
  snapshotResolver: '<rootDir>/tests-src/snapshotResolver.js'
}
