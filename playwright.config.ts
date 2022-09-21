export default {
  timeout: process.env.CI ? undefined : 5000, // Max execution time of any single test
  expect: {
    timeout: 1000, // Max execution time of single expect() calls
  },
  reporter: 'dot',
  fullyParallel: true,
  webServer: {
    command: 'npm run serve -- --port 4000 -l warn',
    url: 'http://localhost:4000/',
    timeout: 10 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4000/',
    browserName: 'chromium',
    headless: true,
    forbidOnly: process.env.CI,
  },
};
