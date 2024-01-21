import { HightouchClient } from '../../analytics';
import * as api from '../../api';
import { defaultApiHost } from '../../constants';
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

  it('disables device mode plugins to prevent dups', async () => {
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

  it('marks unbundled plugins where the cloud mode is disabled', async () => {
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

  it('marks active integrations as unbundled if plugin is not bundled', async () => {
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
  });
});
