/**
 * Error types reported through the errorHandler in the client
 */
export enum ErrorType {
  NetworkUnexpectedHTTPCode,
  NetworkServerLimited,
  NetworkServerRejected,
  NetworkUnknown,

  JsonUnableToSerialize,
  JsonUnableToDeserialize,
  JsonUnknown,

  PluginError,

  InitializationError,
  ResetError,
  FlushError,
}

/**
 * Hightouch Error object for ErrorHandler option
 */
export class HightouchError extends Error {
  type: ErrorType;
  message: string;
  innerError?: unknown;

  constructor(type: ErrorType, message: string, innerError?: unknown) {
    super(message);
    Object.setPrototypeOf(this, HightouchError.prototype);
    this.type = type;
    this.message = message;
    this.innerError = innerError;
  }
}

/**
 * Custom Error type for Hightouch HTTP Error responses
 */
export class NetworkError extends HightouchError {
  statusCode: number;
  type:
    | ErrorType.NetworkServerLimited
    | ErrorType.NetworkServerRejected
    | ErrorType.NetworkUnexpectedHTTPCode
    | ErrorType.NetworkUnknown;

  constructor(statusCode: number, message: string, innerError?: unknown) {
    let type: ErrorType;
    if (statusCode === 429) {
      type = ErrorType.NetworkServerLimited;
    } else if (statusCode > 300 && statusCode < 400) {
      type = ErrorType.NetworkUnexpectedHTTPCode;
    } else if (statusCode >= 400) {
      type = ErrorType.NetworkServerRejected;
    } else {
      type = ErrorType.NetworkUnknown;
    }

    super(type, message, innerError);
    Object.setPrototypeOf(this, NetworkError.prototype);

    this.statusCode = statusCode;
    this.type = type;
  }
}

/**
 * Error type for JSON Serialization errors
 */
export class JSONError extends HightouchError {
  constructor(
    type: ErrorType.JsonUnableToDeserialize | ErrorType.JsonUnableToSerialize,
    message: string,
    innerError?: unknown
  ) {
    super(type, message, innerError);
    Object.setPrototypeOf(this, JSONError.prototype);
  }
}

/**
 * HTTP status codes that indicate a transient server issue worth retrying.
 * The event collector returns 400 (validation), 401 (auth), 404 (invalid
 * write key on webhooks), and 500 (server error). Only 5xx and 429 are
 * transient — all other codes indicate the server will never accept this
 * request, so events should be dropped rather than retried.
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Determines whether a failed request should be retried based on the error.
 * Only 5xx/429 are retryable; all 4xx client errors are permanent.
 */
export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof NetworkError) {
    return RETRYABLE_STATUS_CODES.has(error.statusCode);
  }
  // Network failures (no status code), timeouts, etc. are retryable
  return true;
};

/**
 * HTTP status codes that indicate a request-scoped problem (auth, routing)
 * rather than an event-scoped problem (validation). Splitting a batch won't
 * help — every sub-batch will fail with the same error.
 */
const REQUEST_SCOPED_STATUS_CODES = new Set([401, 403, 404]);

/**
 * Returns true if the error is a request-scoped 4xx (e.g. bad auth or
 * invalid write key) where splitting the batch cannot help.
 */
export const isRequestScopedError = (error: unknown): boolean => {
  if (error instanceof NetworkError) {
    return REQUEST_SCOPED_STATUS_CODES.has(error.statusCode);
  }
  return false;
};

/**
 * Utility method for handling HTTP fetch errors
 * @param response Fetch Response
 * @returns response if status OK, throws NetworkError for everything else
 */
export const checkResponseForErrors = (response: Response) => {
  if (!response.ok) {
    throw new NetworkError(response.status, response.statusText);
  }

  return response;
};

/**
 * Converts a .fetch() error to a HightouchError object for reporting to the error handler
 * @param error any JS error instance
 * @returns a HightouchError object
 */
export const translateHTTPError = (error: unknown): HightouchError => {
  // HightouchError already
  if (error instanceof HightouchError) {
    return error;
    // JSON Deserialization Errors
  } else if (error instanceof SyntaxError) {
    return new JSONError(
      ErrorType.JsonUnableToDeserialize,
      error.message,
      error
    );

    // HTTP Errors
  } else {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown error';
    return new NetworkError(-1, message, error);
  }
};
