import fetchMock from 'fetch-mock';

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.CSS = {
    escape: (str) => str,
  };
});

afterEach(() => {
  fetchMock.reset();
});
vi.mock('nanoid/non-secure', () => {
  return { nanoid: () => '1234' };
});
