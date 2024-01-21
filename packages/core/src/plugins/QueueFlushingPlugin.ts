import { createStore, Store } from '@ht-sdks/sovran-react-native';
import type { HightouchClient } from '../analytics';
import { defaultConfig } from '../constants';
import { UtilityPlugin } from '../plugin';
import { PluginType, HightouchEvent } from '../types';

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

  /**
   * @param onFlush callback to execute when the queue is flushed (either by reaching the limit or manually) e.g. code to upload events to your destination
   */
  constructor(
    onFlush: (events: HightouchEvent[]) => Promise<void>,
    storeKey = 'events'
  ) {
    super();
    this.onFlush = onFlush;
    this.storeKey = storeKey;
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
          // TODO: Does it persist in local storage to handle restarts?
          persistor: config.storePersistor,
          saveDelay: config.storePersistorSaveDelay ?? 0,
        },
      }
    );
  }

  async execute(event: HightouchEvent): Promise<HightouchEvent | undefined> {
    await this.queueStore?.dispatch((state) => {
      const events = [...state.events, event];
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

      const setToRemove = new Set(eventsToRemove);
      const filteredEvents = state.events.filter((e) => !setToRemove.has(e));
      return { events: filteredEvents };
    });
  }
}
