module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
  testTimeout: 30000,
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  testEnvironment: 'jest-environment-puppeteer',
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
  verbose: true
};