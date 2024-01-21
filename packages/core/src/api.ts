import type { HightouchEvent } from './types';

export const uploadEvents = async ({
  writeKey,
  url,
  events,
}: {
  writeKey: string;
  url: string;
  events: HightouchEvent[];
}) => {
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
  });
};
