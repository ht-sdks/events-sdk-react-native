import type { Unsubscribe, Persistor } from '@ht-sdks/sovran-react-native';
import type { HightouchAPIConsentSettings } from '..';
import type {
  Context,
  DeepPartial,
  DestinationFilters,
  IntegrationSettings,
  RoutingRule,
  HightouchAPIIntegrations,
  HightouchEvent,
  UserInfoState,
} from '../types';

export interface getStateFunc<T> {
  (): T;
  (safe: true): Promise<T>;
}

/**
 * Implements a value that can be subscribed for changes
 */
export interface Watchable<T> {
  /**
   * Get current value
   */
  get: getStateFunc<T>;
  /**
   * Register a callback to be called when the value changes
   * @returns a function to unsubscribe
   */
  onChange: (callback: (value: T) => void) => Unsubscribe;
}

/**
 * Implements a value that can be set
 */
export interface Settable<T> {
  set: (value: T | ((state: T) => T)) => T | Promise<T>;
}

/**
 * Implements a queue object
 */
export interface Queue<T, R> {
  add: (value: T) => Promise<R>;
  remove: (value: T) => Promise<R>;
}

/**
 * Implements a map of key value pairs
 */
export interface Dictionary<K, T, R> {
  add: (key: K, value: T) => Promise<R>;
}

export interface ReadinessStore {
  hasRestoredContext: boolean;
  hasRestoredSettings: boolean;
  hasRestoredUserInfo: boolean;
  hasRestoredFilters: boolean;
  hasRestoredPendingEvents: boolean;
}

/**
 * Interface for interacting with the storage layer of the client data
 */
export interface Storage {
  readonly isReady: Watchable<boolean>;

  readonly context: Watchable<DeepPartial<Context> | undefined> &
    Settable<DeepPartial<Context>>;

  readonly settings: Watchable<HightouchAPIIntegrations | undefined> &
    Settable<HightouchAPIIntegrations> &
    Dictionary<string, IntegrationSettings, HightouchAPIIntegrations>;

  readonly consentSettings: Watchable<HightouchAPIConsentSettings | undefined> &
    Settable<HightouchAPIConsentSettings | undefined>;

  readonly filters: Watchable<DestinationFilters | undefined> &
    Settable<DestinationFilters> &
    Dictionary<string, RoutingRule, DestinationFilters>;

  readonly userInfo: Watchable<UserInfoState> & Settable<UserInfoState>;

  readonly deepLinkData: Watchable<DeepLinkData>;

  readonly pendingEvents: Watchable<HightouchEvent[]> &
    Settable<HightouchEvent[]> &
    Queue<HightouchEvent, HightouchEvent[]>;
}
export type DeepLinkData = {
  referring_application: string;
  url: string;
};

export type StorageConfig = {
  storeId: string;
  storePersistor?: Persistor;
  storePersistorSaveDelay?: number;
};
