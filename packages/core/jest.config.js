module.exports = {
  roots: ['tests'],
  coverageReporters: [
    'lcov', 'text-summary', 'html'
  ],
  collectCoverageFrom: [
    'dist/node/**/*.js'
  ],
  moduleNameMapper: {
    '^src-node/(.*)$': '<rootDir>/dist/node/$1'
  }
}
