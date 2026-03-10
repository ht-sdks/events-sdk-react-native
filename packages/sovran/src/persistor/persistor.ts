export interface PersistenceConfig {
  /**
   * Unique identifier for the store
   */
  storeId: string;
  /**
   * Delay in ms to wait before saving state (only applies to async persistors)
   */
  saveDelay?: number;
  /**
   * Persistor
   */
  persistor?: Persistor;
  /**
   * Callback to be called when the store is initialized
   */
  onInitialized?: (state: unknown) => void;
}

export const PersistorType = {
  SYNC: 'sync',
  ASYNC: 'async',
} as const;

export type PersistorTypeValue =
  (typeof PersistorType)[keyof typeof PersistorType];

/**
 * Async persistor interface (e.g., AsyncStorage)
 * Writes are asynchronous and may be debounced via saveDelay.
 */
export interface AsyncPersistor {
  type: typeof PersistorType.ASYNC;
  get: <T>(key: string) => Promise<T | undefined>;
  set: <T>(key: string, state: T) => Promise<void>;
}

/**
 * Sync persistor interface (e.g., MMKV)
 * Writes are synchronous via JSI, eliminating race conditions where events
 * could be lost if the app terminates before an async write completes.
 */
export interface SyncPersistor {
  type: typeof PersistorType.SYNC;
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, state: T) => void;
}

export type Persistor = AsyncPersistor | SyncPersistor;
