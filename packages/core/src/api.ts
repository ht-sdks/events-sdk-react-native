import type { HightouchEvent } from './types';

const DEFAULT_UPLOAD_TIMEOUT_MS = 5_000;

export const uploadEvents = async ({
  writeKey,
  url,
  events,
  timeout = DEFAULT_UPLOAD_TIMEOUT_MS,
}: {
  writeKey: string;
  url: string;
  events: HightouchEvent[];
  timeout?: number;
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        batch: events,
        sentAt: new Date().toISOString(),
        writeKey: writeKey,
      }),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};
