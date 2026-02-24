import type { HightouchEvent } from './types';
import {
  defaultRequestTimeout,
  defaultMaxRetries,
  defaultRetryBaseDelay,
} from './constants';

export interface UploadConfig {
  timeout?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    if (
      error.message.includes('network') ||
      error.message.includes('Network') ||
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return true;
    }
  }
  return false;
};

const isRetryableStatusCode = (status: number): boolean => {
  return status === 429 || status >= 500;
};

export const uploadEvents = async ({
  writeKey,
  url,
  events,
  config = {},
}: {
  writeKey: string;
  url: string;
  events: HightouchEvent[];
  config?: UploadConfig;
}): Promise<Response> => {
  const timeout = config.timeout ?? defaultRequestTimeout;
  const maxRetries = config.maxRetries ?? defaultMaxRetries;
  const retryBaseDelay = config.retryBaseDelay ?? defaultRetryBaseDelay;

  const requestOptions: RequestInit = {
    method: 'POST',
    body: JSON.stringify({
      batch: events,
      sentAt: new Date().toISOString(),
      writeKey: writeKey,
    }),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  };

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetchWithTimeout(url, requestOptions, timeout);

      if (response.ok || !isRetryableStatusCode(response.status)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

      if (attempt < maxRetries) {
        const delay = retryBaseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delay = retryBaseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }

    attempt++;
  }

  throw lastError;
};
