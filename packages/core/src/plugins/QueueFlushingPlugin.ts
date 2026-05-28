import { createStore, Store } from '@ht-sdks/sovran-react-native';
import type { HightouchClient } from '../analytics';
import { defaultConfig } from '../constants';
import { ErrorType, HightouchError } from '../errors';
import { UtilityPlugin } from '../plugin';
import { PluginType, HightouchEvent } from '../types';

const DEFAULT_RESTORE_TIMEOUT_MS = 1000;

/** A one-shot readiness signal you can wait on, with a timeout. */
class ReadySignal {
  private readonly opened: Promise<void>;
  private resolveOpened!: () => void;
  private isOpen = false;
  private timeoutPromise?: Promise<void>;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private timeoutReported = false;

  constructor(private readonly timeoutMs: number) {
    this.opened = new Promise<void>((resolve) => {
      this.resolveOpened = resolve;
    });
  }

  /** Marks the signal as ready, releasing all current and future waiters. */
  open(): void {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.resolveOpened();
  }

  /**
   * Resolves when opened, or when the timeout fires.
   * Invokes onTimeout (at most once across all waiters) if the timeout wins.
   * Errors thrown by onTimeout are swallowed; wait() never rejects.
   */
  async wait(onTimeout?: (e: Error) => void): Promise<void> {
    if (this.isOpen) {
      return;
    }

    this.timeoutPromise ??= new Promise<void>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = undefined;
        resolve();
      }, this.timeoutMs);
    });

    await Promise.race([this.opened, this.timeoutPromise]);

    if (this.isOpen || this.timeoutReported) {
      return;
    }

    this.timeoutReported = true;
    try {
      onTimeout?.(new Error(`ReadySignal timed out after ${this.timeoutMs}ms`));
    } catch {
      // best-effort: don't let timeout reporting fail the wait
    }
  }
}

/**
 * This plugin manages a queue where all events get added to after timeline processing.
 * It takes a onFlush callback to trigger any action particular to your destination sending events.
 * It can autotrigger a flush of the queue when it reaches the config flushAt limit.
 */
export class QueueFlushingPlugin extends UtilityPlugin {
  // Gets executed last to keep the queue after all timeline processing is done
  type = PluginType.after;

  private storeKey: string;
  private queueStore: Store<{ events: HightouchEvent[] }> | undefined;
  private onFlush: (events: HightouchEvent[]) => Promise<void>;

  /**
   * Signaled once sovran has hydrated the queue from persistence, or fails after a timeout.
   * flush() waits on this so we don't upload an empty queue while the previous session's events are still loading.
   */
  private readonly restored: ReadySignal;

  /**
   * Tracks the in-flight flush, if any, so overlapping flush() calls attach to it instead of starting a parallel upload.
   * Note that this technically does mean overlapping flushes won't re-snapshot the queue,
   * but we're choosing to accept that rather than risking performance hits on the caller.
   */
  private flushPromise?: Promise<void>;

  /**
   * @param onFlush callback to execute when the queue is flushed (either by reaching the limit or manually) e.g. code to upload events to your destination
   * @param storeKey persistence key suffix; must be unique to avoid AsyncStorage collisions
   */
  constructor(
    onFlush: (events: HightouchEvent[]) => Promise<void>,
    storeKey = 'events'
  ) {
    super();
    this.onFlush = onFlush;
    this.storeKey = storeKey;
    this.restored = new ReadySignal(DEFAULT_RESTORE_TIMEOUT_MS);
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
          onInitialized: () => {
            this.restored.open();
          },
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
   *
   * Concurrent callers share a single in-flight upload.
   * This means in rare scenarios where overlapping flushes are occurring,
   * an event coming in between the two flushes may not be finished by the time the flush resolves.
   */
  async flush(): Promise<void> {
    if (this.flushPromise !== undefined) {
      await this.flushPromise;
      return;
    }

    this.flushPromise = this.runFlush();
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = undefined;
    }
  }

  private async runFlush(): Promise<void> {
    await this.restored.wait((e) =>
      this.analytics?.reportInternalError(
        new HightouchError(
          ErrorType.InitializationError,
          'Queue restoration did not complete before timeout; flushing with in-memory state',
          e
        )
      )
    );

    const events = (await this.queueStore?.getState(true))?.events ?? [];
    await this.onFlush(events);
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

      const idsToRemove = new Set(eventsToRemove.map((e) => e.messageId));
      const filteredEvents = state.events.filter(
        (e) => !idsToRemove.has(e.messageId)
      );
      return { events: filteredEvents };
    });
  }
}
