import { createStore } from '@ht-sdks/sovran-react-native';

import { MockEventStore } from '../../test-helpers';
import { EventType, HightouchEvent } from '../../types';
import { QueueFlushingPlugin } from '../QueueFlushingPlugin';

import type { HightouchClient } from '../../analytics';
jest.mock('@ht-sdks/sovran-react-native');

describe('QueueFlushingPlugin', () => {
  function setupQueuePlugin(
    onFlush: (events: HightouchEvent[]) => Promise<void>,
    flushAt: number
  ) {
    const queuePlugin = new QueueFlushingPlugin(onFlush);
    // We override the createStore before the queue plugin is initialized to use our own mocked event store
    (createStore as jest.Mock).mockReturnValue(new MockEventStore());
    queuePlugin.configure({
      getConfig: () => ({
        writeKey: 'HIGHTOUCH_KEY',
        flushAt,
      }),
    } as unknown as HightouchClient);

    // Mock the create store just before the queue plugin creates its store
    return queuePlugin;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should queue events when executed in the timeline', async () => {
    const onFlush = jest.fn();
    const queuePlugin = setupQueuePlugin(onFlush, 10);

    const result = await queuePlugin.execute({
      type: EventType.TrackEvent,
      event: 'test1',
      properties: {
        test: 'test1',
      },
    } as HightouchEvent);

    expect(result).not.toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(queuePlugin.queueStore?.getState().events).toHaveLength(1);

    // No flush called yet
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('should dequeue events on demand', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queuePlugin = setupQueuePlugin(onFlush, 10);

    const event: HightouchEvent = {
      type: EventType.TrackEvent,
      event: 'test2',
      properties: {
        test: 'test2',
      },
    };

    const result = await queuePlugin.execute(event);

    expect(result).not.toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(queuePlugin.queueStore?.getState().events).toHaveLength(1);
    await queuePlugin.dequeue(event);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(queuePlugin.queueStore?.getState().events).toHaveLength(0);
  });
});
