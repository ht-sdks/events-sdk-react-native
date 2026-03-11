import { HightouchClient } from '../../analytics';
import * as api from '../../api';
import { defaultApiHost } from '../../constants';
import { NetworkError } from '../../errors';
import {
  createMockStoreGetter,
  getMockLogger,
  MockHightouchStore,
} from '../../test-helpers';
import {
  Config,
  EventType,
  HightouchAPIIntegration,
  HightouchEvent,
  TrackEventType,
  UpdateType,
} from '../../types';
import {
  HIGHTOUCH_DESTINATION_KEY,
  HightouchDestination,
} from '../HightouchDestination';

jest.mock('uuid');

describe('HightouchDestination', () => {
  const store = new MockHightouchStore();
  const clientArgs = {
    logger: getMockLogger(),
    config: {
      writeKey: '123-456',
      maxBatchSize: 2,
      flushInterval: 0,
    },
    store,
  };

  beforeEach(() => {
    store.reset();
    jest.clearAllMocks();
  });

  it('executes', async () => {
    const plugin = new HightouchDestination();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    plugin.analytics = new HightouchClient(clientArgs);
    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {
        Firebase: false,
      },
    };
    const result = await plugin.execute(event);
    expect(result).toEqual(event);
  });

  // Device mode plugins aren't currently supported.
  it.skip('disables device mode plugins to prevent dups', async () => {
    const plugin = new HightouchDestination();
    const analytics = new HightouchClient({
      ...clientArgs,
      store: new MockHightouchStore({
        settings: {
          firebase: {
            someConfig: 'someValue',
          },
          [HIGHTOUCH_DESTINATION_KEY]: {},
        },
      }),
    });
    plugin.configure(analytics);

    plugin.analytics!.getPlugins = jest.fn().mockReturnValue([
      {
        key: 'firebase',
        type: 'destination',
      },
    ]);

    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {},
    };

    const result = await plugin.execute(event);
    expect(result).toEqual({
      ...event,
      _metadata: {
        bundled: ['firebase'],
        unbundled: [],
        bundledIds: [],
      },
    });
  });

  // Device mode plugins aren't currently supported.
  it.skip('marks unbundled plugins where the cloud mode is disabled', async () => {
    const plugin = new HightouchDestination();
    const analytics = new HightouchClient({
      ...clientArgs,
      store: new MockHightouchStore({
        settings: {
          [HIGHTOUCH_DESTINATION_KEY]: {
            unbundledIntegrations: ['firebase'],
            maybeBundledConfigIds: {},
          },
        },
      }),
    });
    plugin.configure(analytics);

    plugin.analytics!.getPlugins = jest.fn().mockReturnValue([
      {
        key: 'firebase',
        type: 'destination',
      },
    ]);

    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {},
    };

    const result = await plugin.execute(event);
    expect(result).toEqual({
      ...event,
      _metadata: {
        bundled: [],
        unbundled: ['firebase'],
        bundledIds: [],
      },
    });
  });

  // Device mode plugins aren't currently supported.
  it.skip('marks active integrations as unbundled if plugin is not bundled', async () => {
    const plugin = new HightouchDestination();
    const analytics = new HightouchClient({
      ...clientArgs,
      store: new MockHightouchStore({
        settings: {
          [HIGHTOUCH_DESTINATION_KEY]: {
            unbundledIntegrations: ['Amplitude'],
          },
          Mixpanel: {}, // Mixpanel is active but not bundled
        },
      }),
    });
    plugin.configure(analytics);

    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {},
    };

    const result = await plugin.execute(event);
    expect(result).toEqual({
      ...event,
      _metadata: {
        bundled: [],
        unbundled: ['Mixpanel', 'Amplitude'],
        bundledIds: [],
      },
    });
  });

  it('lets plugins/events override destination settings', async () => {
    const plugin = new HightouchDestination();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    plugin.analytics = new HightouchClient({
      ...clientArgs,
      store: new MockHightouchStore({
        settings: {
          firebase: {
            someConfig: 'someValue',
          },
          [HIGHTOUCH_DESTINATION_KEY]: {},
        },
      }),
    });

    plugin.analytics.getPlugins = jest.fn().mockReturnValue([
      {
        key: 'firebase',
        type: 'destination',
      },
    ]);

    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {
        firebase: true,
      },
    };

    const result = await plugin.execute(event);
    expect(result).toEqual(event);
  });

  it('lets plugins/events disable destinations individually', async () => {
    const plugin = new HightouchDestination();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    plugin.analytics = new HightouchClient({
      ...clientArgs,
      store: new MockHightouchStore({
        settings: {
          [HIGHTOUCH_DESTINATION_KEY]: {},
        },
      }),
    });

    const event: TrackEventType = {
      anonymousId: '3534a492-e975-4efa-a18b-3c70c562fec2',
      event: 'Awesome event',
      type: EventType.TrackEvent,
      properties: {},
      timestamp: '2000-01-01T00:00:00.000Z',
      messageId: '1d1744bf-5beb-41ac-ad7a-943eac33babc',
      context: { app: { name: 'TestApp' } },
      integrations: {
        [HIGHTOUCH_DESTINATION_KEY]: false,
      },
    };

    const result = await plugin.execute(event);
    expect(result).toEqual(undefined);
  });

  describe('uploads', () => {
    const createTestWith = ({
      config,
      settings,
      events,
    }: {
      config?: Config;
      settings?: HightouchAPIIntegration;
      events: HightouchEvent[];
    }) => {
      const plugin = new HightouchDestination();

      const analytics = new HightouchClient({
        ...clientArgs,
        config: config ?? clientArgs.config,
        store: new MockHightouchStore({
          settings: {
            [HIGHTOUCH_DESTINATION_KEY]: {},
          },
        }),
      });

      plugin.configure(analytics);
      // The settings store won't match but that's ok, the plugin should rely only on the settings it receives during update
      plugin.update(
        {
          integrations: {
            [HIGHTOUCH_DESTINATION_KEY]: settings ?? {},
          },
        },
        UpdateType.initial
      );

      jest
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .spyOn(plugin.queuePlugin.queueStore!, 'getState')
        .mockImplementation(createMockStoreGetter(() => ({ events })));

      const sendEventsSpy = jest
        .spyOn(api, 'uploadEvents')
        .mockResolvedValue({ ok: true } as Response);

      return {
        plugin,
        sendEventsSpy,
      };
    };

    it('chunks the events correctly', async () => {
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
        { messageId: 'message-3' },
        { messageId: 'message-4' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({
        events: events,
      });

      await plugin.flush();

      expect(sendEventsSpy).toHaveBeenCalledTimes(2);
      expect(sendEventsSpy).toHaveBeenCalledWith({
        url: defaultApiHost,
        writeKey: '123-456',
        events: events.slice(0, 2).map((e) => ({
          ...e,
        })),
      });
      expect(sendEventsSpy).toHaveBeenCalledWith({
        url: defaultApiHost,
        writeKey: '123-456',
        events: events.slice(2, 4).map((e) => ({
          ...e,
        })),
      });
    });

    it('uses hightouch settings apiHost for uploading events', async () => {
      const customEndpoint = 'events.eu1.hightouchapis.com';
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({
        events: events,
        settings: {
          apiKey: '',
          apiHost: customEndpoint,
        },
      });

      await plugin.flush();

      expect(sendEventsSpy).toHaveBeenCalledTimes(1);
      expect(sendEventsSpy).toHaveBeenCalledWith({
        url: `https://${customEndpoint}/b`,
        writeKey: '123-456',
        events: events.slice(0, 2).map((e) => ({
          ...e,
        })),
      });
    });

    it('lets user override apiHost with proxy', async () => {
      const customEndpoint = 'https://customproxy.com/batchEvents';
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({
        events: events,
        settings: {
          apiKey: '',
          apiHost: 'events.eu1.hightouchapis.com',
        },
        config: {
          ...clientArgs.config,
          proxy: customEndpoint,
        },
      });

      await plugin.flush();

      expect(sendEventsSpy).toHaveBeenCalledTimes(1);
      expect(sendEventsSpy).toHaveBeenCalledWith({
        url: customEndpoint,
        writeKey: '123-456',
        events: events.slice(0, 2).map((e) => ({
          ...e,
        })),
      });
    });

    it('drops a single-event batch on non-retryable HTTP errors (e.g. 400)', async () => {
      const events = [
        { messageId: 'message-1' },
      ] as HightouchEvent[];

      const { plugin } = createTestWith({
        events,
        config: { ...clientArgs.config, maxBatchSize: 1 },
      });

      jest.spyOn(api, 'uploadEvents').mockRejectedValue(
        new NetworkError(400, 'Bad Request')
      );

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      expect(dequeueSpy).toHaveBeenCalled();
      const dequeuedEvents = dequeueSpy.mock.calls[0][0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(1);
    });

    it('splits batch on non-retryable error to isolate the bad event', async () => {
      // maxBatchSize is 2, so [message-1, message-2] is one batch
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({ events });

      sendEventsSpy
        // Batch [message-1, message-2]: 400
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Split left — single event message-1: 400 (poison event)
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Split right — single event message-2: ok
        .mockResolvedValueOnce({ ok: true } as Response);

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // message-1 (poison) dropped + message-2 sent = 2 dequeued
      expect(dequeueSpy).toHaveBeenCalled();
      const lastCall = dequeueSpy.mock.calls[dequeueSpy.mock.calls.length - 1];
      const dequeuedEvents = lastCall![0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(2);

      // 3 upload attempts: original batch, left split, right split
      expect(sendEventsSpy).toHaveBeenCalledTimes(3);
    });

    it('retains events on retryable errors (5xx) without splitting', async () => {
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({ events });

      sendEventsSpy.mockRejectedValue(
        new NetworkError(500, 'Internal Server Error')
      );

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // 5xx is retryable — events stay in queue, no splitting
      expect(dequeueSpy).toHaveBeenCalled();
      const dequeuedEvents = dequeueSpy.mock.calls[0][0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(0);

      // Only 1 upload attempt — no splitting on retryable errors
      expect(sendEventsSpy).toHaveBeenCalledTimes(1);
    });

    it('retains events on network timeout (non-NetworkError)', async () => {
      const events = [
        { messageId: 'message-1' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({
        events,
        config: { ...clientArgs.config, maxBatchSize: 1 },
      });

      sendEventsSpy.mockRejectedValue(new Error('The operation was aborted'));

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // Generic errors are retryable — event stays in queue
      expect(dequeueSpy).toHaveBeenCalled();
      const dequeuedEvents = dequeueSpy.mock.calls[0][0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(0);
      expect(sendEventsSpy).toHaveBeenCalledTimes(1);
    });

    it('handles split where one half succeeds and the other hits 5xx', async () => {
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({ events });

      sendEventsSpy
        // Batch [message-1, message-2]: 400 triggers split
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Left split — message-1: succeeds
        .mockResolvedValueOnce({ ok: true } as Response)
        // Right split — message-2: 500 (retryable)
        .mockRejectedValueOnce(new NetworkError(500, 'Internal Server Error'));

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // message-1 sent and dequeued, message-2 retained
      expect(dequeueSpy).toHaveBeenCalled();
      const lastCall = dequeueSpy.mock.calls[dequeueSpy.mock.calls.length - 1];
      const dequeuedEvents = lastCall![0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(1);
      expect(dequeuedEvents[0]!.messageId).toBe('message-1');

      expect(sendEventsSpy).toHaveBeenCalledTimes(3);
    });

    it('drops all events when every event in batch is poison', async () => {
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({ events });

      // Every request returns 400
      sendEventsSpy.mockRejectedValue(new NetworkError(400, 'Bad Request'));

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // Both events dropped
      expect(dequeueSpy).toHaveBeenCalled();
      const lastCall = dequeueSpy.mock.calls[dequeueSpy.mock.calls.length - 1];
      const dequeuedEvents = lastCall![0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(2);

      // 3 calls: original batch, left single, right single
      expect(sendEventsSpy).toHaveBeenCalledTimes(3);
    });

    it('isolates poison event via deeper recursion in a 4-event batch', async () => {
      const events = [
        { messageId: 'message-1' },
        { messageId: 'message-2' },
        { messageId: 'message-3' },
        { messageId: 'message-4' },
      ] as HightouchEvent[];

      const { plugin, sendEventsSpy } = createTestWith({
        events,
        config: { ...clientArgs.config, maxBatchSize: 4 },
      });

      sendEventsSpy
        // Batch [1,2,3,4]: 400
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Left [1,2]: succeeds
        .mockResolvedValueOnce({ ok: true } as Response)
        // Right [3,4]: 400
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Right-left [3]: 400 (poison)
        .mockRejectedValueOnce(new NetworkError(400, 'Bad Request'))
        // Right-right [4]: succeeds
        .mockResolvedValueOnce({ ok: true } as Response);

      const dequeueSpy = jest.spyOn(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        plugin.queuePlugin,
        'dequeue'
      );

      await plugin.flush();

      // 3 sent (1,2,4) + 1 dropped (3) = 4 dequeued
      expect(dequeueSpy).toHaveBeenCalled();
      const lastCall = dequeueSpy.mock.calls[dequeueSpy.mock.calls.length - 1];
      const dequeuedEvents = lastCall![0] as HightouchEvent[];
      expect(dequeuedEvents).toHaveLength(4);

      expect(sendEventsSpy).toHaveBeenCalledTimes(5);
    });
  });
});
