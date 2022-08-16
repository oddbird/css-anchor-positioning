import { jest } from '@jest/globals';
import fetchMock from 'fetch-mock-jest';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => fetchMock.reset());
