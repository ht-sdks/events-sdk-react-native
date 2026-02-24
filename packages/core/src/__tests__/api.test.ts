import {
  Context,
  EventType,
  HightouchAPIIntegrations,
  TrackEventType,
  UserTraits,
} from '../types';
import { uploadEvents } from '../api';
import * as context from '../context';

describe('#sendEvents', () => {
  beforeEach(() => {
    jest
      .spyOn(context, 'getContext')
      .mockImplementationOnce(
        async (userTraits?: UserTraits): Promise<Context> => {
          return {
            traits: userTraits ?? {},
          } as Context;
        }
      );

    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2001-01-01T00:00:00.000Z');
  });

  async function sendAnEventPer(writeKey: string, toUrl: string) {
    const mockResponse = Promise.resolve('MANOS');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve(mockResponse));

    const serializedEventProperties: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
    };

    // Context and Integration exist on HightouchEvents but are transmitted separately to avoid duplication
    const additionalEventProperties: {
      context: Context;
      integrations: HightouchAPIIntegrations;
    } = {
      context: await context.getContext({ name: 'Hello' }),
      integrations: {
        Firebase: false,
      },
    };

    const event = {
      ...serializedEventProperties,
      ...additionalEventProperties,
    };

    await uploadEvents({
      writeKey: writeKey,
      url: toUrl,
      events: [event],
    });

    expect(fetch).toHaveBeenCalledWith(
      toUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          batch: [event],
          sentAt: '2001-01-01T00:00:00.000Z',
          writeKey: 'HIGHTOUCH_KEY',
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        signal: expect.any(AbortSignal),
      })
    );
  }

  it('sends an event', async () => {
    const toHightouchBatchApi = 'https://api.hightouch.io/v1.b';
    const writeKey = 'HIGHTOUCH_KEY';

    await sendAnEventPer(writeKey, toHightouchBatchApi);
  });

  it('sends an event to proxy', async () => {
    const toProxyUrl = 'https://myprox.io/b';
    const writeKey = 'HIGHTOUCH_KEY';

    await sendAnEventPer(writeKey, toProxyUrl);
  });
});

describe('#uploadEvents retry behavior', () => {
  const testEvent: TrackEventType = {
    anonymousId: 'test-anon-id',
    event: 'Test Event',
    type: EventType.TrackEvent,
    properties: {},
    timestamp: '2000-01-01T00:00:00.000Z',
    messageId: 'test-message-id',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2001-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries on 500 status codes', async () => {
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const uploadPromise = uploadEvents({
      writeKey: 'TEST_KEY',
      url: 'https://api.test.com/b',
      events: [testEvent],
      config: { maxRetries: 3, retryBaseDelay: 100 },
    });

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);

    const result = await uploadPromise;

    expect(result.ok).toBe(true);
    expect(callCount).toBe(3);
  });

  it('retries on 429 status codes', async () => {
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const uploadPromise = uploadEvents({
      writeKey: 'TEST_KEY',
      url: 'https://api.test.com/b',
      events: [testEvent],
      config: { maxRetries: 3, retryBaseDelay: 100 },
    });

    await jest.advanceTimersByTimeAsync(100);

    const result = await uploadPromise;

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it('does not retry on 4xx client errors (except 429)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      return Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });
    });

    const result = await uploadEvents({
      writeKey: 'TEST_KEY',
      url: 'https://api.test.com/b',
      events: [testEvent],
      config: { maxRetries: 3, retryBaseDelay: 100 },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors', async () => {
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const uploadPromise = uploadEvents({
      writeKey: 'TEST_KEY',
      url: 'https://api.test.com/b',
      events: [testEvent],
      config: { maxRetries: 3, retryBaseDelay: 100 },
    });

    await jest.advanceTimersByTimeAsync(100);

    const result = await uploadPromise;

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it('throws after exhausting all retries', async () => {
    jest.useRealTimers();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      return Promise.reject(new Error('Network error'));
    });

    await expect(
      uploadEvents({
        writeKey: 'TEST_KEY',
        url: 'https://api.test.com/b',
        events: [testEvent],
        config: { maxRetries: 2, retryBaseDelay: 10 },
      })
    ).rejects.toThrow('Network error');

    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff for retries', async () => {
    const delays: number[] = [];
    let lastCallTime = Date.now();
    let callCount = 0;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => {
      const now = Date.now();
      if (callCount > 0) {
        delays.push(now - lastCallTime);
      }
      lastCallTime = now;
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const uploadPromise = uploadEvents({
      writeKey: 'TEST_KEY',
      url: 'https://api.test.com/b',
      events: [testEvent],
      config: { maxRetries: 3, retryBaseDelay: 100 },
    });

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);
    await jest.advanceTimersByTimeAsync(400);

    await uploadPromise;

    expect(delays.length).toBe(3);
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(400);
  });
});
