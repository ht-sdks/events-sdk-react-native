import { createStore, Store } from '@ht-sdks/sovran-react-native';
import type { HightouchClient } from '../analytics';
import { defaultConfig } from '../constants';
import { UtilityPlugin } from '../plugin';
import { PluginType, HightouchEvent } from '../types';

const DEFAULT_FLUSH_TIMEOUT = 120000; // 2 minutes max for a flush operation

/**
 * This plugin manages a queue where all events get added to after timeline processing.
 * It takes a onFlush callback to trigger any action particular to your destination sending events.
 * It can autotrigger a flush of the queue when it reaches the config flushAt limit.
 */
export class QueueFlushingPlugin extends UtilityPlugin {
  type = PluginType.after;

  private storeKey: string;
  private isPendingUpload = false;
  private flushPendingExecution = false;
  private queueStore: Store<{ events: HightouchEvent[] }> | undefined;
  private onFlush: (events: HightouchEvent[]) => Promise<void>;
  private flushTimeout: ReturnType<typeof setTimeout> | undefined;

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
      return { events };
    });
    return event;
  }

  /**
   * Calls the onFlush callback with the events in the queue.
   * If a flush is already in progress, marks that another flush should execute after.
   */
  async flush() {
    if (this.isPendingUpload) {
      this.flushPendingExecution = true;
      return;
    }

    await this.executeFlush();
  }

  private async executeFlush() {
    const events = (await this.queueStore?.getState(true))?.events ?? [];

    if (events.length === 0) {
      return;
    }

    try {
      this.isPendingUpload = true;

      this.flushTimeout = setTimeout(() => {
        this.isPendingUpload = false;
        this.flushTimeout = undefined;
      }, DEFAULT_FLUSH_TIMEOUT);

      await this.onFlush(events);
    } finally {
      if (this.flushTimeout !== undefined) {
        clearTimeout(this.flushTimeout);
        this.flushTimeout = undefined;
      }
      this.isPendingUpload = false;

      if (this.flushPendingExecution) {
        this.flushPendingExecution = false;
        void this.executeFlush();
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
