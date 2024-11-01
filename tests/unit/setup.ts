import fetchMock from 'fetch-mock';

beforeAll(() => {
  fetchMock.mockGlobal();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.CSS = {
    escape: (str) => str,
  };
});

afterEach(() => {
  fetchMock.removeRoutes();
});
