import fs from 'fs';

import type {
  BrowserDefinition,
  ResultData,
  TestPathMap,
  VersionResult,
} from './wpt.js';

function gradientBar(active: number, total: number): string {
  const stop = `${((active / total) * 100).toFixed(0)}%`;
  return `style="background-image: linear-gradient(to right, darkgreen ${stop}, maroon ${stop})"`;
}

export default function writeReport(
  results: BrowserDefinition[],
  name?: string,
) {
  const testResultsFolder = 'test-results';
  const fileName = name || new Date().toISOString().replace(':', '-');
  if (!fs.existsSync(testResultsFolder)) fs.mkdirSync(testResultsFolder);

  // Save the raw JSON data to debug / process further
  fs.writeFileSync(
    `${testResultsFolder}/${fileName}.json`,
    JSON.stringify(results, null, 2),
  );

  // Create an object mapping each test path with the results for all versions
  const byPath: TestPathMap = {};
  results.forEach((browser) => {
    browser.versions.forEach((version) => {
      const data = version.data as ResultData;
      data.results?.forEach(([longPath, result]) => {
        const path = longPath.replace('http://web-platform.test:8000/', '');
        const passed = result.tests.reduce(
          (total, test) => total + (test.status ? 0 : 1),
          0,
        );
        const total = result.tests.length;
        const data: VersionResult = {
          name: `${browser.name} ${version.name}`,
          summary: [passed, total],
        };
        byPath[path] ? byPath[path].push(data) : (byPath[path] = [data]);
      });
    });
  });

  // Render the HTML report
  // Each test gets a row, and the columns are the browser versions
  const tableHtml = `
  <style>
  td {border: 1px solid}
  .bar {color: white; background-color: maroon}
  </style>
  <table>
    <thead>
      <tr>
        <th>Test</th>
        ${results
          .map((browser) =>
            browser.versions
              .map((version) => `<th>${browser.name}<br>${version.name}</th>`)
              .join(''),
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
        ${Object.keys(byPath)
          .map(
            (testPath) =>
              `<tr>
                <td>${testPath}</td>
                ${byPath[testPath]
                  .map(
                    ({ summary: [pass, total] }) =>
                      `<td class="bar" ${gradientBar(pass, total)}>
                        ${pass} / ${total}
                      </td>`,
                  )
                  .join('')}
              </tr>`,
          )
          .join('')}
    </tbody>
  </table>
  `;
  fs.writeFileSync(`${testResultsFolder}/${fileName}.html`, tableHtml);
}
