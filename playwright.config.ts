export default {
  timeout: process.env.CI ? undefined : 3000, // Max execution time of any single test
  expect: {
    timeout: 1000, // Max execution time of single expect() calls
  },
  // Running the server through Playwright errors when using native ESM.
  // Likely related to: https://github.com/nodejs/node/issues/34049
  // webServer: {
  //   command: 'PORT=4000 LEVEL=warning yarn serve',
  //   url: 'http://localhost:4000/',
  //   timeout: 10 * 1000,
  //   reuseExistingServer: !process.env.CI,
  // },
  use: {
    baseURL: 'http://localhost:4000',
    browserName: 'chromium',
    headless: true,
    forbidOnly: process.env.CI,
  },
};
