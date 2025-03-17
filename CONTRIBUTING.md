# Contributing to the CSS Anchor Positioning Polyfill

Ideas, issues, and pull-requests are welcome!

- [**Github Issues**](https://github.com/oddbird/css-anchor-positioning/issues/)
  are the best place to request a feature, file a bug, or just ask a question.
  Also a great place to discuss possible features before you submit a PR.
- **Pull Requests** are a big help, if you're willing to jump in and make things
  happen. For a bugfix, or documentation, just jump right in. For major changes
  or new features, it's best to discuss in an issue first.

## Conduct

Please follow the [OddBird Code of Conduct](https://www.oddbird.net/conduct/).

## How it works

At a high level, the CSS Anchor Positioning Polyfill parses all relevant CSS on
the page, and finds any uses of CSS Anchor Positioning syntax (e.g. `anchor()`,
`anchor-name`, `anchor-size()`, `position-try`, `@position-try`, etc.). It
replaces each use of `anchor()` with a unique CSS custom property. It then
determines pixel values for each CSS custom property based on the individual
`anchor()` usage (that is, the anchor element, target element, anchor side, and
inset property it's applied to), and sets those values on the root element of
the document. This allows the CSS cascade to determine which styles actually
apply to which elements on the page.

## Development

- Clone the repository.
- Install dependencies: `npm install`.
- Start dev server: `npm run serve`. Visit `localhost:3000`.

## Code style

JS code is formatted with prettier, and CSS is formatted with stylelint.

- Lint: `npm run lint:ci`
- Format & lint: `npm run lint`

We recommend setting up your IDE to automatically format code for you.

## Testing

Unit tests and end-to-end tests are available in the `tests/` folder.

- Run all tests: `npm run test`
- Run unit tests: `npm run test:unit`
- Run end-to-end tests:
  - Configure Playwright (this step is only required once or when the version of
    `@playwright/test` changes in package.json):
    `npx playwright install --with-deps`
  - Run tests (Chromium only): `npm run test:e2e`
  - Run tests (Chromium, Firefox & Webkit): `npm run test:e2e:ci`

## Previewing Pull Requests

Active pull requests on the polyfill can be tested using the built version
hosted within the preview environment.

> **IMPORTANT**
>
> These previews are ephemeral, and will stop working after the pull request is
> merged. Do not use this for any purpose other than testing the pull request.

All polyfills are located at the root of the preview environment. For instance, the CommonJS functional version for PR 123 would be available at
https://deploy-preview-123--anchor-polyfill.netlify.app/css-anchor-positioning-fn.umd.cjs.
