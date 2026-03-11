import { NetworkError, isRetryableError } from '../errors';

describe('isRetryableError', () => {
  it.each([429, 500, 502, 503, 504])(
    'returns true for retryable status code %d',
    (statusCode) => {
      const error = new NetworkError(statusCode, 'Server error');
      expect(isRetryableError(error)).toBe(true);
    }
  );

  it.each([400, 401, 403, 404, 410, 422])(
    'returns false for non-retryable status code %d',
    (statusCode) => {
      const error = new NetworkError(statusCode, 'Client error');
      expect(isRetryableError(error)).toBe(false);
    }
  );

  it('returns true for generic errors (network failures, timeouts)', () => {
    expect(isRetryableError(new Error('Network request failed'))).toBe(true);
    expect(isRetryableError(new Error('The operation was aborted'))).toBe(true);
  });

  it('returns false for NetworkError with unknown status code', () => {
    const error = new NetworkError(-1, 'Unknown error');
    expect(isRetryableError(error)).toBe(false);
  });
});
