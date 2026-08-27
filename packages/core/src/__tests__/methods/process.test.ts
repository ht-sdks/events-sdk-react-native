import { HightouchClient } from '../../analytics';
import { getMockLogger, MockHightouchStore } from '../../test-helpers';
import { EventType, HightouchEvent } from '../../types';

jest.mock('uuid');

jest
  .spyOn(Date.prototype, 'toISOString')
  .mockReturnValue('2999-01-01T00:00:00.000Z');

describe('process', () => {
  const store = new MockHightouchStore({
    userInfo: {
      userId: 'current-user-id',
      anonymousId: 'very-anonymous',
    },
    context: {
      library: {
        name: 'test',
        version: '1.0',
      },
    },
  });

  const clientArgs = {
    config: {
      writeKey: 'mock-write-key',
      flushInterval: 0,
    },
    logger: getMockLogger(),
    store: store,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stamps basic data: timestamp and messageId for pending events when not ready', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(false);
    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track('Some Event', { id: 1 });

    let expectedEvent: Record<string, unknown> = {
      event: 'Some Event',
      properties: {
        id: 1,
      },
      type: EventType.TrackEvent,
    };

    // While not ready only timestamp and messageId should be defined
    // @ts-ignore
    const pendingEvents = client.store.pendingEvents.get();
    expect(pendingEvents.length).toBe(1);
    const pendingEvent = pendingEvents[0];
    expect(pendingEvent).toMatchObject(expectedEvent);
    expect(pendingEvent.messageId).not.toBeUndefined();
    expect(pendingEvent.timestamp).not.toBeUndefined();

    // Not yet processed
    expect(timeline.process).not.toHaveBeenCalled();

    // When ready it replays events
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);
    // @ts-ignore
    await client.onReady();
    // @ts-ignore
    await client.processPendingEvents();
    expectedEvent = {
      ...expectedEvent,
      context: { ...store.context.get() },
      userId: store.userInfo.get().userId,
      anonymousId: store.userInfo.get().anonymousId,
    };

    // @ts-ignore
    expect(client.store.pendingEvents.get().length).toBe(0);

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining(expectedEvent)
    );
  });

  it('stamps all context and userInfo data for events when ready', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);

    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track('Some Event', { id: 1 });

    const expectedEvent = {
      event: 'Some Event',
      properties: {
        id: 1,
      },
      type: EventType.TrackEvent,
      context: { ...store.context.get() },
      userId: store.userInfo.get().userId,
      anonymousId: store.userInfo.get().anonymousId,
    } as HightouchEvent;

    // @ts-ignore
    const pendingEvents = client.store.pendingEvents.get();
    expect(pendingEvents.length).toBe(0);

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining(expectedEvent)
    );
  });

  it('enrichment closure gets applied', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);

    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track('Some Event', { id: 1 }, (event) => {
      event.anonymousId = 'foo';
      return event;
    });

    const expectedEvent = {
      event: 'Some Event',
      properties: {
        id: 1,
      },
      type: EventType.TrackEvent,
      context: { ...store.context.get() },
      userId: store.userInfo.get().userId,
      anonymousId: 'foo',
    } as HightouchEvent;

    // @ts-ignore
    const pendingEvents = client.store.pendingEvents.get();
    expect(pendingEvents.length).toBe(0);

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining(expectedEvent)
    );
  });
});

describe('per-call enrichment closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const stampSchemaVersion =
    (version: string) =>
    (event: HightouchEvent): HightouchEvent => {
      // `protocols` is not part of the SDK's Context type; per-call closures
      // may stamp arbitrary context keys, hence the cast.
      event.context = {
        ...event.context,
        protocols: { schemaVersion: version },
      } as HightouchEvent['context'];
      return event;
    };

  const getProtocols = (event?: HightouchEvent) =>
    (event?.context as { protocols?: { schemaVersion?: string } } | undefined)
      ?.protocols;

  const setup = () => {
    const testStore = new MockHightouchStore({
      userInfo: {
        userId: 'current-user-id',
        anonymousId: 'very-anonymous',
      },
      context: {
        library: {
          name: 'test',
          version: '1.0',
        },
        os: {
          name: 'test-os',
          version: '9.9',
        },
      },
    });

    const client = new HightouchClient({
      config: {
        writeKey: 'mock-write-key',
        flushInterval: 0,
      },
      logger: getMockLogger(),
      store: testStore,
    });
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);

    // @ts-ignore
    const processSpy = jest.spyOn(client.timeline, 'process');

    const processedEvents = () =>
      Promise.all(
        processSpy.mock.results.map(
          (r) => r.value as Promise<HightouchEvent | undefined>
        )
      );

    return { client, store: testStore, processedEvents };
  };

  it('overlapping alias calls keep their own enrichment stamps', async () => {
    const { client, processedEvents } = setup();

    // Fire both without awaiting so their processing overlaps
    await Promise.all([
      client.alias('first-new-user', stampSchemaVersion('alias-v1')),
      client.alias('second-new-user', stampSchemaVersion('alias-v2')),
    ]);

    const processed = await processedEvents();
    expect(processed).toHaveLength(2);

    const first = processed.find((e) => e?.userId === 'first-new-user');
    const second = processed.find((e) => e?.userId === 'second-new-user');
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(getProtocols(first)?.schemaVersion).toBe('alias-v1');
    expect(getProtocols(second)?.schemaVersion).toBe('alias-v2');
  });

  it('closure stamps context.protocols while platform context stays intact', async () => {
    const { client, processedEvents } = setup();

    await client.track(
      'Stamped Event',
      { id: 1 },
      stampSchemaVersion('track-v1')
    );

    const [processed] = await processedEvents();
    expect(getProtocols(processed)?.schemaVersion).toBe('track-v1');
    expect(processed?.context?.library).toEqual({
      name: 'test',
      version: '1.0',
    });
    expect(processed?.context?.os).toEqual({
      name: 'test-os',
      version: '9.9',
    });

    // The closure never reaches the wire: functions are dropped by JSON serialization
    const serialized = JSON.parse(JSON.stringify(processed)) as Record<
      string,
      unknown
    >;
    expect('enrichment' in serialized).toBe(false);
  });

  it('a later event without a closure has no protocols key in context', async () => {
    const { client, processedEvents } = setup();

    await client.track(
      'Stamped Event',
      { id: 1 },
      stampSchemaVersion('track-v1')
    );
    await client.track('Plain Event', { id: 2 });

    const processed = await processedEvents();
    expect(processed).toHaveLength(2);

    const plain = processed[1];
    expect(getProtocols(plain)).toBeUndefined();
    expect(Object.keys(plain?.context ?? {})).not.toContain('protocols');
  });

  it('omitted enrichment leaves the serialized payload unchanged', async () => {
    const { client, store: testStore, processedEvents } = setup();

    await client.track('No Closure', { id: 1 });

    const [processed] = await processedEvents();
    const serialized = JSON.parse(JSON.stringify(processed)) as Record<
      string,
      unknown
    >;

    expect('enrichment' in serialized).toBe(false);
    expect(serialized).toEqual({
      type: EventType.TrackEvent,
      event: 'No Closure',
      properties: { id: 1 },
      context: { ...testStore.context.get() },
      userId: 'current-user-id',
      anonymousId: 'very-anonymous',
      messageId: expect.any(String),
      timestamp: '2999-01-01T00:00:00.000Z',
      integrations: {},
    });
  });
});
