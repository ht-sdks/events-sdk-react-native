import { AppState, AppStateStatus } from 'react-native';
import type { Persistor } from '@ht-sdks/sovran-react-native';

import { HightouchClient } from '../../analytics';
import {
  BackgroundFlushPolicy,
  CountFlushPolicy,
  StartupFlushPolicy,
  type FlushPolicy,
} from '../../flushPolicies';
import { UtilityPlugin } from '../../plugin';
import { SovranStorage } from '../../storage';
import { getMockLogger } from '../../test-helpers';
import { EventType, HightouchEvent, PluginType } from '../../types';

jest.mock('react-native');
jest.mock('uuid');

type PersistedValue = Record<string, unknown> | undefined;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks(count = 20) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class TestPersistor implements Persistor {
  private values = new Map<string, unknown>();
  private delayedGets = new Map<
    string,
    ReturnType<typeof deferred<PersistedValue>>
  >();

  delayGet(key: string) {
    this.delayedGets.set(key, deferred<PersistedValue>());
  }

  resolveGet(key: string, value: PersistedValue) {
    this.values.set(key, value);
    this.delayedGets.get(key)?.resolve(value);
    this.delayedGets.delete(key);
  }

  get = async <T>(key: string): Promise<T | undefined> => {
    const delayed = this.delayedGets.get(key);
    if (delayed !== undefined) {
      return (await delayed.promise) as T | undefined;
    }
    return this.values.get(key) as T | undefined;
  };

  set = async <T>(key: string, state: T): Promise<void> => {
    this.values.set(key, state);
  };

  peek<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }
}

function createClient({
  writeKey,
  persistor,
  flushPolicies,
  trackAppLifecycleEvents = false,
}: {
  writeKey: string;
  persistor: Persistor;
  flushPolicies: FlushPolicy[];
  trackAppLifecycleEvents?: boolean;
}) {
  return new HightouchClient({
    config: {
      writeKey,
      flushPolicies,
      trackAppLifecycleEvents,
      storePersistor: persistor,
    },
    logger: getMockLogger(),
    store: new SovranStorage({
      storeId: writeKey,
      storePersistor: persistor,
    }),
  });
}

function expectUploadedEvent(fetchMock: jest.Mock, eventName: string) {
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: expect.stringContaining(eventName),
    })
  );
}

function expectPersistedQueuedEvent(
  persistor: TestPersistor,
  writeKey: string,
  eventName: string
) {
  const persistedQueue = persistor.peek<{ events: HightouchEvent[] }>(
    `${writeKey}-events`
  );
  expect(persistedQueue?.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: EventType.TrackEvent,
        event: eventName,
      }),
    ])
  );
}

describe('event delivery', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
    }));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads events restored from the persisted destination queue on startup', async () => {
    const writeKey = 'startup-restore-key';
    const persistor = new TestPersistor();
    const queueKey = `${writeKey}-events`;
    const restoredEvent: HightouchEvent = {
      type: EventType.TrackEvent,
      event: 'Restored Purchase',
      messageId: 'restored-message-id',
      timestamp: '2010-01-01T00:00:00.000Z',
      integrations: {},
    };

    persistor.delayGet(queueKey);

    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new StartupFlushPolicy()],
    });

    await client.init();

    expect(fetchMock).not.toHaveBeenCalled();

    persistor.resolveGet(queueKey, { events: [restoredEvent] });
    await flushMicrotasks();

    expectUploadedEvent(fetchMock, 'Restored Purchase');

    client.cleanup();
  });

  it('uploads a tracked event when flush() is awaited after track() completes', async () => {
    const writeKey = 'awaited-flush-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });

    await client.init();

    await client.track('Purchase Completed', { transaction_id: 'txn-1' });
    await client.flush();

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });

  it('uploads a tracked event when flush() is called immediately after track()', async () => {
    const writeKey = 'flush-after-track-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });

    await client.init();

    // Customer wrapper pattern: fire-and-forget track followed by immediate flush
    // to "guarantee delivery before the user backgrounds". The track() promise is
    // intentionally not awaited because the wrapper is synchronous.
    void client.track('Purchase Completed', { transaction_id: 'txn-1' });
    void client.flush();

    await flushMicrotasks(50);

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });

  it('persists a tracked event without an explicit flush', async () => {
    const writeKey = 'persist-without-flush-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });

    await client.init();

    void client.track('Purchase Completed', { transaction_id: 'txn-1' });
    await wait(50);

    expect(fetchMock).not.toHaveBeenCalled();
    expectPersistedQueuedEvent(persistor, writeKey, 'Purchase Completed');

    client.cleanup();
  });

  it('keeps a tracked event persisted when upload fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    const writeKey = 'persist-after-upload-failure-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });

    await client.init();

    await client.track('Purchase Completed', { transaction_id: 'txn-1' });
    await client.flush();
    await wait(50);

    expect(fetchMock).toHaveBeenCalled();
    expectPersistedQueuedEvent(persistor, writeKey, 'Purchase Completed');

    client.cleanup();
  });

  it('uploads the event that triggers CountFlushPolicy(1)', async () => {
    const writeKey = 'count-flush-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new CountFlushPolicy(1)],
    });

    await client.init();

    void client.track('Purchase Completed', { transaction_id: 'txn-1' });
    await flushMicrotasks(50);

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });

  it('uploads events tracked before init completes', async () => {
    const writeKey = 'pre-ready-count-flush-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new CountFlushPolicy(1)],
    });

    void client.init();
    void client.track('Purchase Completed', { transaction_id: 'txn-1' });

    await wait(50);

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });

  it('uploads pre-ready events when flush() is awaited before init completes', async () => {
    const writeKey = 'pre-ready-manual-flush-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });

    const initPromise = client.init();
    void client.track('Purchase Completed', { transaction_id: 'txn-1' });

    await client.flush();
    await initPromise;
    await flushMicrotasks(50);

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });

  it('does not reject flush when init reports a late replay failure', async () => {
    const writeKey = 'pre-ready-flush-late-init-failure-key';
    const persistor = new TestPersistor();
    const initialPendingEvent: HightouchEvent = {
      type: EventType.TrackEvent,
      event: 'Initial Pending Event',
      messageId: 'initial-pending-message-id',
      timestamp: '2999-01-01T00:00:00.000Z',
      integrations: {},
    };
    await persistor.set(`${writeKey}-pendingEvents`, [initialPendingEvent]);

    class ThrowingPolicy extends CountFlushPolicy {
      onEvent(event: HightouchEvent): void {
        if (
          event.type === EventType.TrackEvent &&
          event.event === 'Initial Pending Event'
        ) {
          throw new Error('Replay policy failure');
        }
        super.onEvent(event);
      }
    }

    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new ThrowingPolicy(1)],
    });

    const initPromise = client.init();
    let initResolved = false;
    const observedInitPromise = initPromise.then(() => {
      initResolved = true;
    });

    await expect(client.flush()).resolves.toBeUndefined();
    expect(initResolved).toBe(true);
    await expect(observedInitPromise).resolves.toBeUndefined();

    client.cleanup();
  });

  it('uploads events tracked during pending-event replay before init completes', async () => {
    const writeKey = 'pending-replay-track-key';
    const persistor = new TestPersistor();
    const initialPendingEvent: HightouchEvent = {
      type: EventType.TrackEvent,
      event: 'Initial Pending Event',
      messageId: 'initial-pending-message-id',
      timestamp: '2999-01-01T00:00:00.000Z',
      integrations: {},
    };
    await persistor.set(`${writeKey}-pendingEvents`, [initialPendingEvent]);

    class TrackDuringReplayPlugin extends UtilityPlugin {
      type = PluginType.enrichment;

      execute(event: HightouchEvent): HightouchEvent {
        if (
          event.type === EventType.TrackEvent &&
          event.event === 'Initial Pending Event'
        ) {
          void this.analytics?.track('Nested Purchase Completed', {
            transaction_id: 'txn-nested',
          });
        }
        return event;
      }
    }

    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new CountFlushPolicy(1)],
    });
    client.add({ plugin: new TrackDuringReplayPlugin() });

    await client.init();
    await flushMicrotasks(50);

    expectUploadedEvent(fetchMock, 'Nested Purchase Completed');

    client.cleanup();
  });

  it('flush() triggered during pending replay uploads every replayed event', async () => {
    // Regression: with the old `!isReady && initPromise` guard in flush(),
    // a flush call that landed after isReady=true but before
    // processPendingEvents finished would snapshot the destination queue
    // partway through replay. With no other flush trigger in play (empty
    // policies), the remaining events would sit in the queue indefinitely.
    const writeKey = 'flush-during-replay-key';
    const persistor = new TestPersistor();
    const persistedEvents: HightouchEvent[] = [
      {
        type: EventType.TrackEvent,
        event: 'Pending 1',
        messageId: 'pending-1',
        timestamp: '2999-01-01T00:00:00.000Z',
        integrations: {},
      },
      {
        type: EventType.TrackEvent,
        event: 'Pending 2',
        messageId: 'pending-2',
        timestamp: '2999-01-01T00:00:00.000Z',
        integrations: {},
      },
      {
        type: EventType.TrackEvent,
        event: 'Pending 3',
        messageId: 'pending-3',
        timestamp: '2999-01-01T00:00:00.000Z',
        integrations: {},
      },
    ];
    await persistor.set(`${writeKey}-pendingEvents`, persistedEvents);

    let capturedFlushPromise: Promise<void> | undefined;

    class FlushDuringReplayPlugin extends UtilityPlugin {
      type = PluginType.enrichment;
      execute(event: HightouchEvent): HightouchEvent {
        if (
          event.type === EventType.TrackEvent &&
          event.event === 'Pending 1' &&
          capturedFlushPromise === undefined
        ) {
          capturedFlushPromise = this.analytics?.flush();
        }
        return event;
      }
    }

    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [],
    });
    client.add({ plugin: new FlushDuringReplayPlugin() });

    await client.init();
    await capturedFlushPromise;

    expectUploadedEvent(fetchMock, 'Pending 1');
    expectUploadedEvent(fetchMock, 'Pending 2');
    expectUploadedEvent(fetchMock, 'Pending 3');

    client.cleanup();
  });

  it('uploads queued events when an active app enters background', async () => {
    const callbacks: Array<(state: AppStateStatus) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        (_event, callback: (state: AppStateStatus) => void) => {
          callbacks.push(callback);
          return { remove: jest.fn() };
        }
      );
    AppState.currentState = 'active';

    const writeKey = 'background-key';
    const persistor = new TestPersistor();
    const client = createClient({
      writeKey,
      persistor,
      flushPolicies: [new BackgroundFlushPolicy()],
      trackAppLifecycleEvents: true,
    });

    await client.init();
    await client.track('Purchase Completed', { transaction_id: 'txn-1' });

    callbacks.forEach((callback) => callback('background'));
    await flushMicrotasks();

    expectUploadedEvent(fetchMock, 'Purchase Completed');

    client.cleanup();
  });
});
