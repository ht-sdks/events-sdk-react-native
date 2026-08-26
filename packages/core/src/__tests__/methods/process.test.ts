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

  it('preserves per-call context when replaying pending events', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(false);
    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track(
      'Some Event',
      { id: 1 },
      { protocols: { schemaVersion: 'v1' } }
    );

    // @ts-ignore
    const pendingEvent = client.store.pendingEvents.get()[0];
    expect(pendingEvent).toEqual(
      expect.objectContaining({
        event: 'Some Event',
        properties: { id: 1 },
        context: {
          protocols: { schemaVersion: 'v1' },
        },
      })
    );

    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);
    // @ts-ignore
    await client.onReady();
    // @ts-ignore
    await client.processPendingEvents();

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Some Event',
        properties: { id: 1 },
        context: {
          ...store.context.get(),
          protocols: { schemaVersion: 'v1' },
        },
      })
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
    expect(
      (timeline.process as jest.Mock).mock.calls[0][0].context
    ).not.toHaveProperty('protocols');
  });

  it('deep-merges per-call context onto the processed event context', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);

    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track(
      'Some Event',
      { id: 1 },
      { protocols: { schemaVersion: 'v1' } }
    );

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Some Event',
        properties: {
          id: 1,
        },
        type: EventType.TrackEvent,
        context: {
          ...store.context.get(),
          protocols: {
            schemaVersion: 'v1',
          },
        },
        userId: store.userInfo.get().userId,
        anonymousId: store.userInfo.get().anonymousId,
      })
    );
  });

  it('merges nested per-call context maps next to existing context', async () => {
    const nestedStore = new MockHightouchStore({
      userInfo: {
        userId: 'current-user-id',
        anonymousId: 'very-anonymous',
      },
      context: {
        library: {
          name: 'test',
          version: '1.0',
        },
        protocols: {
          existing: true,
        },
      },
    });
    const client = new HightouchClient({
      ...clientArgs,
      store: nestedStore,
    });
    jest.spyOn(client.isReady, 'value', 'get').mockReturnValue(true);

    // @ts-ignore
    const timeline = client.timeline;
    jest.spyOn(timeline, 'process');

    await client.track(
      'Some Event',
      { id: 1 },
      { protocols: { schemaVersion: 'v1' } }
    );

    expect(timeline.process).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: {
          id: 1,
        },
        context: {
          library: {
            name: 'test',
            version: '1.0',
          },
          protocols: {
            existing: true,
            schemaVersion: 'v1',
          },
        },
      })
    );
  });
});
