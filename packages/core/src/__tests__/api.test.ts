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

    expect(fetch).toHaveBeenCalledWith(toUrl, {
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
    });
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

  it('aborts fetch when timeout expires', async () => {
    jest.useFakeTimers();

    let fetchSignal: AbortSignal | undefined;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn((_url: string, options?: RequestInit) => {
      fetchSignal = options?.signal;
      return new Promise((_resolve, reject) => {
        // Wire up abort to reject, like a real fetch
        fetchSignal?.addEventListener('abort', () => {
          reject(new Error('The operation was aborted.'));
        });
      });
    });

    const event = {
      anonymousId: 'anon',
      event: 'Test',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: 'msg-1',
    } as TrackEventType;

    const uploadPromise = uploadEvents({
      writeKey: 'KEY',
      url: 'https://api.test.io/b',
      events: [event],
      timeout: 5000,
    });

    jest.advanceTimersByTime(5000);

    await expect(uploadPromise).rejects.toThrow('aborted');
    expect(fetchSignal?.aborted).toBe(true);

    jest.useRealTimers();
  });
});
