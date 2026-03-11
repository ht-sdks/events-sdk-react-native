import { createStore, Store } from '@ht-sdks/sovran-react-native';
import type { HightouchClient } from '../analytics';
import { defaultConfig } from '../constants';
import { UtilityPlugin } from '../plugin';
import { PluginType, HightouchEvent } from '../types';

const MAX_QUEUE_SIZE = 1000;

/**
 * This plugin manages a queue where all events get added to after timeline processing.
 * It takes a onFlush callback to trigger any action particular to your destination sending events.
 * It can autotrigger a flush of the queue when it reaches the config flushAt limit.
 */
export class QueueFlushingPlugin extends UtilityPlugin {
  // Gets executed last to keep the queue after all timeline processing is done
  type = PluginType.after;

  private storeKey: string;
  private isPendingUpload = false;
  private queueStore: Store<{ events: HightouchEvent[] }> | undefined;
  private onFlush: (events: HightouchEvent[]) => Promise<void>;

  private onQueueOverflow?: (droppedEvents: HightouchEvent[]) => void;

  /**
   * @param onFlush callback to execute when the queue is flushed (either by reaching the limit or manually) e.g. code to upload events to your destination
   * @param storeKey key used for persisting the queue
   * @param onQueueOverflow optional callback invoked with events dropped when the queue exceeds its size cap
   */
  constructor(
    onFlush: (events: HightouchEvent[]) => Promise<void>,
    storeKey = 'events',
    onQueueOverflow?: (droppedEvents: HightouchEvent[]) => void
  ) {
    super();
    this.onFlush = onFlush;
    this.storeKey = storeKey;
    this.onQueueOverflow = onQueueOverflow;
  }

  configure(analytics: HightouchClient): void {
    super.configure(analytics);

    const config = analytics?.getConfig() ?? defaultConfig;

    // Create its own storage per HightouchDestination instance to support multiple instances
    this.queueStore = createStore(
      { events: [] as HightouchEvent[] },
      {
        persist: {
          storeId: `${config.writeKey}-${this.storeKey}`,
          persistor: config.storePersistor,
          saveDelay: config.storePersistorSaveDelay ?? 0,
        },
      }
    );
  }

  async execute(event: HightouchEvent): Promise<HightouchEvent | undefined> {
    await this.queueStore?.dispatch((state) => {
      const events = [...state.events, event];
      if (events.length > MAX_QUEUE_SIZE) {
        const dropped = events.slice(0, events.length - MAX_QUEUE_SIZE);
        this.onQueueOverflow?.(dropped);
        return { events: events.slice(events.length - MAX_QUEUE_SIZE) };
      }
      return { events };
    });
    return event;
  }

  /**
   * Calls the onFlush callback with the events in the queue
   */
  async flush() {
    const events = (await this.queueStore?.getState(true))?.events ?? [];
    if (!this.isPendingUpload) {
      try {
        this.isPendingUpload = true;
        await this.onFlush(events);
      } finally {
        this.isPendingUpload = false;
      }
    }
  }

  /**
   * Removes one or multiple events from the queue
   * @param events events to remove
   */
  async dequeue(events: HightouchEvent | HightouchEvent[]) {
    await this.queueStore?.dispatch((state) => {
      const eventsToRemove = Array.isArray(events) ? events : [events];

      if (eventsToRemove.length === 0 || state.events.length === 0) {
        return state;
      }

      const idsToRemove = new Set(
        eventsToRemove.map((e) => e.messageId)
      );
      const filteredEvents = state.events.filter(
        (e) => !idsToRemove.has(e.messageId)
      );
      return { events: filteredEvents };
    });
  }
}
