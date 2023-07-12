/* eslint-disable no-console */

/**
 * Copyright 2022 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { eachLimit, retry } from 'async';
import browserslist from 'browserslist';
import { Local } from 'browserstack-local';
import fs from 'fs';
import { readFile } from 'fs/promises';
import { Agent } from 'http';
import { Builder, By, until } from 'selenium-webdriver';

import writeReport from './report.js';
type Capabilities = Record<string, unknown>;

const enum DataType {
  FetchDescriptor,
  Result,
}

export interface ResultData {
  type: DataType.Result;
  summary: [number, number];
  results?: TestResult[];
}

interface FetchDescriptorData {
  type: DataType.FetchDescriptor;
  capabilities: Capabilities;
}

interface BrowserVersion {
  name: string;
  data: FetchDescriptorData | ResultData;
}

export interface BrowserDefinition {
  name: string;
  logo: string;
  versions: BrowserVersion[];
}

interface Subtest {
  name: string;
  properties: object;
  index: number;
  phase: number;
  phases: object;
  PASS: number;
  FAIL: number;
  TIMEOUT: number;
  NOTRUN: number;
  PRECONDITION_FAILED: number;
  status: number;
  message: string;
  stack: string;
}

interface ResultDataDetail {
  type: string;
  tests: Subtest[];
  status: object;
  asserts: object;
}

type TestResult = [string, ResultDataDetail];

interface TestSuite {
  js: string[];
  iframe: [string, string][];
}

const TEST_FOLDERS: string[] = ['css/css-anchor-position'];

// Tests that check DOM implementation details instead of user-facing behavior
const TEST_BLOCKLIST = [
  'anchor-default-basics.html',
  'anchor-name-basics.html',
  'anchor-parse-invalid.html',
  'anchor-parse-valid.html',
  'anchor-query-custom-property-registration.html',
  'anchor-size-parse-invalid.html',
  'anchor-size-parse-valid.html',
  'at-fallback-position-allowed-declarations.html',
  'at-fallback-position-parse.html',
  'position-fallback-basics.html',
];
const TEST_FILTERS = [new RegExp(TEST_BLOCKLIST.join('|'))];

const SUBTEST_FILTERS: RegExp[] = [
  //   /calc\(.*\)/,
  //   /max\(.*\)/,
  //   /style\(.*\)/,
  //   /#container width 399px after padding is applied. #second is removed from the rendering/,
  //   /ex units/,
  //   /ch units/,
  //   /ex relative/,
  //   /ch relative/,
];

function getBrowserVersions(query: string | string[]) {
  return browserslist(query).map((browserString) => {
    const [name, version] = browserString.split(' ');
    return {
      name,
      version:
        !version.includes('.') && !isNaN(parseFloat(version))
          ? `${version}.0`
          : version,
    };
  });
}

const CHROME_DEFINITION: BrowserDefinition = {
  name: 'Chrome',
  logo: 'https://unpkg.com/@browser-logos/chrome@2.0.0/chrome.svg',
  versions: getBrowserVersions('last 2 Chrome versions').map(({ version }) => ({
    name: version,
    data: {
      type: DataType.FetchDescriptor,
      capabilities: {
        'bstack:options': {
          os: 'Windows',
          osVersion: '11',
        },
        browserName: 'Chrome',
        browserVersion: version,
      },
    },
  })),
};

// Safari on iOS requires specific OS/browser pairs, so we can't use browserslist
const SAFARI_IOS_DEFINITION: BrowserDefinition = {
  name: 'Safari (iOS)',
  logo: 'https://unpkg.com/@browser-logos/safari-ios@1.0.15/safari-ios.svg',
  versions: [
    ['iPhone 14', '16'],
    ['iPhone 13', '15'],
  ].map(([deviceName, browserVersion]) => ({
    name: browserVersion,
    data: {
      type: DataType.FetchDescriptor,
      capabilities: {
        'bstack:options': {
          deviceName,
        },
        browserName: 'safari',
        browserVersion,
      },
    },
  })),
};

// Safari on macOS requires specific OS/browser pairs, so we can't use browserslist
const SAFARI_MACOS_DEFINITION: BrowserDefinition = {
  name: 'Safari (macOS)',
  logo: 'https://unpkg.com/@browser-logos/safari-ios@1.0.15/safari-ios.svg',
  versions: [
    ['Ventura', '16'],
    ['Monterey', '15.6'],
  ].map(([osVersion, browserVersion]) => ({
    name: browserVersion,
    data: {
      type: DataType.FetchDescriptor,
      capabilities: {
        'bstack:options': {
          os: 'OS X',
          osVersion,
        },
        browserName: 'safari',
        browserVersion,
      },
    },
  })),
};

const EDGE_DEFINITION: BrowserDefinition = {
  name: 'Edge',
  logo: 'https://unpkg.com/@browser-logos/edge@2.0.5/edge.svg',
  versions: getBrowserVersions('last 2 Edge versions').map(({ version }) => ({
    name: version,
    data: {
      type: DataType.FetchDescriptor,
      capabilities: {
        'bstack:options': {
          os: 'Windows',
          osVersion: '11',
        },
        browserName: 'Edge',
        browserVersion: version,
      },
    },
  })),
};

const FIREFOX_DEFINITION: BrowserDefinition = {
  name: 'Firefox',
  logo: 'https://unpkg.com/@browser-logos/firefox@3.0.9/firefox.svg',
  versions: getBrowserVersions('last 2 Firefox versions').map(
    ({ version }) => ({
      name: version,
      data: {
        type: DataType.FetchDescriptor,
        capabilities: {
          'bstack:options': {
            os: 'Windows',
            osVersion: '11',
          },
          browserName: 'Firefox',
          browserVersion: version,
        },
      },
    }),
  ),
};

const SAMSUNG_INTERNET_DEFINITION: BrowserDefinition = {
  name: 'Samsung',
  logo: 'https://unpkg.com/@browser-logos/samsung-internet@4.0.6/samsung-internet.svg',
  versions: getBrowserVersions('last 2 Samsung versions').map(
    ({ version }) => ({
      name: version,
      data: {
        type: DataType.FetchDescriptor,
        capabilities: {
          'bstack:options': {
            osVersion: '12.0',
            deviceName: 'Samsung Galaxy S22 Ultra',
          },
          browserName: 'samsung',
          browserVersion: version,
        },
      },
    }),
  ),
};

const BROWSERS: BrowserDefinition[] = [
  CHROME_DEFINITION,
  SAFARI_IOS_DEFINITION,
  SAFARI_MACOS_DEFINITION,
  EDGE_DEFINITION,
  FIREFOX_DEFINITION,
  SAMSUNG_INTERNET_DEFINITION,
];

function createLocalServer(): Promise<Local> {
  return new Promise((resolve, reject) => {
    const server = new Local();
    server.start(
      {
        key: process.env.BROWSERSTACK_ACCESS_KEY,
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(server);
        }
      },
    );
  });
}

function stopLocalServer(server: Local): Promise<void> {
  return new Promise((resolve) => {
    server.stop(resolve);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValue(obj: any, path: string) {
  const paths = path.split('/');
  for (let i = 0, len = paths.length; i < len; i++) obj = obj[paths[i]];
  return obj;
}

async function getTests(manifestPath: string): Promise<TestSuite> {
  const manifestBuffer = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBuffer.toString());

  const js: string[] = [];
  const iframe: [string, string][] = [];

  for (const folder_path of TEST_FOLDERS) {
    // console.info(`folder_path => ${folder_path}`);

    const htmlTests = getValue(manifest.items.testharness, folder_path);
    const refTests = getValue(manifest.items.reftest, folder_path);

    if (refTests) {
      Object.keys(refTests).forEach((name, index) => {
        const data = refTests[name][1][1][0];
        iframe.push(
          [
            `ref${index}_test`,
            `http://web-platform.test:8000/${folder_path}/${name}`,
          ],
          [`ref${index}_match`, `http://web-platform.test:8000${data[0]}`],
        );
      });
    }

    if (htmlTests) {
      js.push(
        ...Object.keys(htmlTests)
          .filter((name) => !TEST_FILTERS.some((filter) => filter.test(name)))
          .map(
            (name) => `http://web-platform.test:8000/${folder_path}/${name}`,
          ),
      );
    }
  }

  return { js, iframe };
}

function createWebDriver(capabilities: Record<string, unknown>) {
  try {
    return new Builder()
      .usingHttpAgent(
        new Agent({
          keepAlive: true,
          keepAliveMsecs: 30 * 1000,
        }),
      )
      .usingServer('http://hub-cloud.browserstack.com/wd/hub')
      .withCapabilities({
        ...capabilities,
        'bstack:options': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(capabilities as any)['bstack:options'],
          userName: process.env.BROWSERSTACK_USERNAME,
          accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
          local: true,
          debug: true,
          consoleLogs: 'verbose',
          networkLogs: true,
          seleniumVersion: '4.1.0',
        },
      })
      .build();
  } catch (e) {
    console.warn(
      `Failed while creating driver with capabilities: ${JSON.stringify(
        capabilities,
      )}`,
    );
    throw e;
  }
}

async function runTestSuite(
  name: string,
  capabilities: Record<string, unknown>,
  testSuite: TestSuite,
): Promise<TestResult[]> {
  const driver = createWebDriver(capabilities);

  try {
    console.info(`[${name}] Connecting...`);
    await driver.get('http://bs-local.com:9606/runner.html');

    console.info(`[${name}] Running tests...`);
    await driver.executeScript(
      `window.RUN_TESTS(${JSON.stringify(testSuite)})`,
    );

    const resultsElem = await driver.wait(
      until.elementLocated(By.id('__test_results__')),
      3 * 60 * 1000,
      'Timed out',
      5 * 1000,
    );
    const result = JSON.parse(await resultsElem.getAttribute('innerHTML'));
    console.info(`[${name}] Finished successfully`);
    return result;
  } catch (err) {
    console.warn(`[${name}] Failed: ${err}`);
    throw err;
  } finally {
    try {
      await driver.close();
      await driver.quit();
    } catch {
      // Some buggy WebDriver implementations could fail during closing,
      // but we want to keep any results we already returned.
    }
  }
}

async function tryOrDefault<T>(fn: () => Promise<T>, def: () => T): Promise<T> {
  try {
    return await fn();
  } catch {
    return def();
  }
}

async function main() {
  const manifestPath = process.env.WPT_MANIFEST;
  if (!manifestPath) {
    throw new Error('invariant: WPT_MANIFEST environment variable must be set');
  }

  const testSuite = await getTests(manifestPath);
  console.info(`JS Tests:\n${testSuite.js.join('\n')}\n`);
  console.info(
    `Iframe Tests:\n${testSuite.iframe.map(([, path]) => path).join('\n')}\n`,
  );

  const tests: (() => Promise<void>)[] = [];
  const results: BrowserDefinition[] = BROWSERS.map((browser) => ({
    ...browser,
    versions: browser.versions.map((version) => {
      const result: BrowserVersion = {
        ...version,
      };
      tests.push(async () => {
        const data = version.data;
        if (data.type === DataType.FetchDescriptor) {
          const results = await tryOrDefault(
            async () =>
              await retry(
                5,
                async () =>
                  await runTestSuite(
                    `${browser.name} ${version.name}`,
                    data.capabilities,
                    testSuite,
                  ),
              ),
            () => [],
          );

          let passed = 0;
          let failed = 0;

          for (const test of results) {
            if (Array.isArray(test) && Array.isArray(test[1].tests)) {
              for (const subtest of test[1].tests) {
                if (
                  SUBTEST_FILTERS.some((filter) => filter.test(subtest.name))
                ) {
                  continue;
                }
                if (subtest.status === subtest.PASS) {
                  passed++;
                } else if (subtest.status !== subtest.PRECONDITION_FAILED) {
                  failed++;
                }
              }
            }
          }

          result.data = {
            type: DataType.Result,
            summary: [passed, failed],
            results,
          };
        }
      });
      return result;
    }),
  }));

  const server = await createLocalServer();
  try {
    await eachLimit(tests, 5, async (test) => await test());
    console.info(`Writing report for ${results.length} results`);
    writeReport(results);

    /* Write an HTML page with links to all historic WPT results */
    const rows = fs
      .readdirSync('test-results')
      .map((name) => `<li><a href="/${name}">${name}</a></li>`)
      .sort()
      .reverse()
      .join('\n');
    const html = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>Test Results</title>
      </head>
      <body>
        <ul>
          ${rows}
        </ul>
      </body>
      </html>`;
    fs.writeFileSync('test-results/history.html', html);
  } finally {
    await stopLocalServer(server);
  }
}

try {
  await main();
} catch (e) {
  console.error('Failed to complete tests:');
  console.error(e);
}
