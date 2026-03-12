import { HightouchClient } from '../../analytics';
import * as context from '../../context';
import { getMockLogger, MockHightouchStore } from '../../test-helpers';
import { PluginType, Context, EventType } from '../../types';
import { UtilityPlugin } from '../../plugin';

jest.mock('uuid');

const currentContext = {
  app: {
    version: '1.0',
    build: '1',
  },
} as Context;

async function flushMicrotasks(count = 20) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

async function drainTimersAndMicrotasks(rounds = 15, ms = 5000) {
  for (let i = 0; i < rounds; i++) {
    jest.advanceTimersByTime(ms);
    await flushMicrotasks();
  }
}

describe('init() resilience', () => {
  beforeEach(() => {
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2010-01-01T00:00:00.000Z');
    jest.spyOn(context, 'getContext').mockResolvedValue(currentContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storageReady timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('completes init when storage never becomes ready', async () => {
      const store = new MockHightouchStore({ isReady: false });
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
        },
        logger,
        store,
      });

      const initPromise = client.init();

      await drainTimersAndMicrotasks();

      await initPromise;

      expect(client.isReady.value).toBe(true);
      expect(store.cancelRestore).toHaveBeenCalled();

      client.cleanup();
    });

    it('does not call cancelRestore when storage resolves in time', async () => {
      const store = new MockHightouchStore({ isReady: true });
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
        },
        logger,
        store,
      });

      await client.init();

      expect(client.isReady.value).toBe(true);
      expect(store.cancelRestore).not.toHaveBeenCalled();

      client.cleanup();
    });
  });

  describe('init retry on failure', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('retries and succeeds on second attempt', async () => {
      const store = new MockHightouchStore();
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
        },
        logger,
        store,
      });

      let callCount = 0;
      // @ts-ignore
      jest.spyOn(client, 'fetchSettings').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient failure');
        }
      });

      const initPromise = client.init();

      await flushMicrotasks();
      jest.advanceTimersByTime(2000);
      await flushMicrotasks();

      await initPromise;

      expect(client.isReady.value).toBe(true);
      expect(callCount).toBe(2);

      client.cleanup();
    });

    it('forces ready after all retries exhausted', async () => {
      const store = new MockHightouchStore();
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
        },
        logger,
        store,
      });

      // @ts-ignore
      jest.spyOn(client, 'fetchSettings').mockRejectedValue(
        new Error('Permanent failure')
      );

      const initPromise = client.init();

      await drainTimersAndMicrotasks();

      await initPromise;

      expect(client.isReady.value).toBe(true);

      client.cleanup();
    });
  });

  describe('onReady fault tolerance', () => {
    it('continues adding plugins when one fails to configure', async () => {
      const store = new MockHightouchStore();
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
          autoAddHightouchDestination: false,
        },
        logger,
        store,
      });

      class FailingPlugin extends UtilityPlugin {
        type = PluginType.enrichment as const;
        configure() {
          throw new Error('Plugin config failed');
        }
        execute = jest.fn(async (event) => event);
      }

      class GoodPlugin extends UtilityPlugin {
        type = PluginType.enrichment as const;
        execute = jest.fn(async (event) => event);
      }

      const failingPlugin = new FailingPlugin();
      const goodPlugin = new GoodPlugin();

      client.add({ plugin: failingPlugin });
      client.add({ plugin: goodPlugin });

      await client.init();

      expect(client.isReady.value).toBe(true);

      const plugins = client.getPlugins(PluginType.enrichment);
      expect(plugins).toContain(goodPlugin);

      client.cleanup();
    });

    it('continues replaying events when one fails', async () => {
      const store = new MockHightouchStore({
        pendingEvents: [
          {
            messageId: 'bad-event',
            type: EventType.TrackEvent,
            event: 'Bad Event',
            timestamp: '2010-01-01T00:00:00.000Z',
            integrations: {},
          },
          {
            messageId: 'good-event',
            type: EventType.TrackEvent,
            event: 'Good Event',
            timestamp: '2010-01-01T00:00:00.000Z',
            integrations: {},
          },
        ],
      });
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
          autoAddHightouchDestination: false,
        },
        logger,
        store,
      });

      // @ts-ignore
      const origProcessing = client.startTimelineProcessing.bind(client);
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.startTimelineProcessing = jest.fn(async (event: any) => {
        if (event.messageId === 'bad-event') {
          throw new Error('Processing failed');
        }
        return origProcessing(event);
      });

      await client.init();

      expect(client.isReady.value).toBe(true);
      // @ts-ignore
      expect(client.startTimelineProcessing).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'good-event' })
      );
      expect(store.pendingEvents.get().length).toBe(0);

      client.cleanup();
    });
  });

  describe('post-timeout identity', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('identify works correctly after storage timeout', async () => {
      const store = new MockHightouchStore({
        isReady: false,
        userInfo: {
          anonymousId: 'fresh-anon-id',
          userId: undefined,
          traits: undefined,
        },
      });
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
          autoAddHightouchDestination: false,
        },
        logger,
        store,
      });

      const initPromise = client.init();

      await drainTimersAndMicrotasks();

      await initPromise;

      expect(client.isReady.value).toBe(true);

      await client.identify('user-123', { name: 'Alice' });

      const userInfo = store.userInfo.get();
      expect(userInfo.userId).toBe('user-123');
      expect(userInfo.anonymousId).toBe('fresh-anon-id');

      // @ts-ignore
      const timeline = client.timeline;
      jest.spyOn(timeline, 'process');

      await client.track('Page View', { page: 'home' });

      expect(timeline.process).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          anonymousId: 'fresh-anon-id',
        })
      );

      client.cleanup();
    });

    it('cancelRestore prevents late merge of persisted anonymousId', async () => {
      const store = new MockHightouchStore({
        isReady: false,
        userInfo: {
          anonymousId: 'fresh-anon-id',
          userId: undefined,
          traits: undefined,
        },
      });
      const logger = getMockLogger();
      const client = new HightouchClient({
        config: {
          writeKey: 'test-key',
          trackAppLifecycleEvents: false,
          autoAddHightouchDestination: false,
        },
        logger,
        store,
      });

      const initPromise = client.init();

      await drainTimersAndMicrotasks();

      await initPromise;

      expect(store.cancelRestore).toHaveBeenCalled();

      await client.identify('user-123');

      expect(store.userInfo.get().anonymousId).toBe('fresh-anon-id');
      expect(store.userInfo.get().userId).toBe('user-123');

      client.cleanup();
    });
  });
});
