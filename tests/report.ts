import fs from 'fs';
import { Liquid } from 'liquidjs';
import type { BrowserDefinition, ResultData } from './wpt.js';

export interface VersionResult {
  name: string;
  summary: [number, number];
}

const localDomain = 'http://web-platform.test:8000/';

export default function writeReport(
  results: BrowserDefinition[],
  name?: string,
) {
  const timeStamp = new Date().toISOString();
  const fileName = name || timeStamp.replaceAll(':', '-');
  if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

  // Save the raw JSON data to debug / process further
  fs.writeFileSync(`test-results/${fileName}.json`, JSON.stringify(results));

  // Create an object mapping each test path with the results for all versions
  const resultsByPath: Record<string, VersionResult[]> = {};
  results.forEach((browser) => {
    browser.versions.forEach((version) => {
      const data = version.data as ResultData;
      data.results?.forEach(([longPath, result]) => {
        const path = longPath.replace(localDomain, '');
        const passed = result.tests?.reduce(
          (total, test) => total + (test.status ? 0 : 1),
          0,
        );
        const total = result.tests?.length;
        const data: VersionResult = {
          name: `${browser.name} ${version.name}`,
          summary: total === undefined ? [-1, -1] : [passed, total],
        };
        resultsByPath[path] = [...(resultsByPath[path] || []), data];
      });
    });
  });

  // Render the HTML report
  const template = fs.readFileSync('tests/report.liquid', 'utf-8');
  const context = {
    wptRepo: process.env.WPT_REPO,
    wptCommit: process.env.WPT_COMMIT,
    sourceRepo: process.env.SOURCE_REPO,
    sourceCommit: process.env.SOURCE_COMMIT,
    sourceBranch: process.env.SOURCE_BRANCH,
    timeStamp,
    localDomain,
    results,
    resultsByPath,
  };
  const output = new Liquid().parseAndRenderSync(template, context);
  // Save with timestamp and as `index.html` to load the latest report by default
  fs.writeFileSync(`test-results/${fileName}.html`, output);
  fs.writeFileSync(`test-results/index.html`, output);
}
