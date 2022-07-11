export default {
  timeout: process.env.CI ? undefined : 3000, // Max execution time of any single test
  expect: {
    timeout: 1000, // Max execution time of single expect() calls
  },
  webServer: {
    command: 'PORT=4000 LEVEL=warning yarn preview',
    url: 'http://localhost:4000/',
    timeout: 10 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4000',
    browserName: 'chromium',
    headless: true,
    forbidOnly: process.env.CI,
  },
}
