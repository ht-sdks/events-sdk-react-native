import { HIGHTOUCH_DESTINATION_KEY } from '../plugins/HightouchDestination';
import type {
  DeepLinkData,
  Dictionary,
  Queue,
  Settable,
  Storage,
  Watchable,
} from '../storage';
import type {
  Context,
  DeepPartial,
  DestinationFilters,
  IntegrationSettings,
  RoutingRule,
  HightouchAPIConsentSettings,
  HightouchAPIIntegrations,
  HightouchEvent,
  UserInfoState,
} from '../types';
import { createCallbackManager } from './utils';
import { createGetter } from '../storage/helpers';

export type StoreData = {
  isReady: boolean;
  context?: DeepPartial<Context>;
  settings: HightouchAPIIntegrations;
  consentSettings?: HightouchAPIConsentSettings;
  filters: DestinationFilters;
  userInfo: UserInfoState;
  deepLinkData: DeepLinkData;
  pendingEvents: HightouchEvent[];
};

const INITIAL_VALUES: StoreData = {
  isReady: true,
  context: undefined,
  settings: {
    [HIGHTOUCH_DESTINATION_KEY]: {},
  },
  consentSettings: undefined,
  filters: {},
  userInfo: {
    anonymousId: 'anonymousId',
    userId: undefined,
    traits: undefined,
  },
  deepLinkData: {
    referring_application: '',
    url: '',
  },
  pendingEvents: [],
};

export function createMockStoreGetter<T>(fn: () => T) {
  return createGetter(fn, () => {
    return new Promise((resolve) => {
      resolve(fn());
    });
  });
}

export class MockHightouchStore implements Storage {
  private data: StoreData;
  private initialData: StoreData;

  reset = () => {
    this.data = JSON.parse(JSON.stringify(this.initialData)) as StoreData;
  };

  constructor(initialData?: Partial<StoreData>) {
    this.data = { ...INITIAL_VALUES, ...initialData };
    this.initialData = JSON.parse(
      JSON.stringify({ ...INITIAL_VALUES, ...initialData })
    ) as StoreData;
  }

  private callbacks = {
    context: createCallbackManager<DeepPartial<Context> | undefined>(),
    settings: createCallbackManager<HightouchAPIIntegrations>(),
    consentSettings: createCallbackManager<
      HightouchAPIConsentSettings | undefined
    >(),
    filters: createCallbackManager<DestinationFilters>(),
    userInfo: createCallbackManager<UserInfoState>(),
    deepLinkData: createCallbackManager<DeepLinkData>(),
    pendingEvents: createCallbackManager<HightouchEvent[]>(),
  };

  readonly isReady = {
    get: createMockStoreGetter(() => {
      return this.data.isReady;
    }),
    onChange: (_callback: (value: boolean) => void) => {
      return () => {
        return;
      };
    },
  };

  readonly context: Watchable<DeepPartial<Context> | undefined> &
    Settable<DeepPartial<Context>> = {
    get: createMockStoreGetter(() => ({ ...this.data.context })),
    onChange: (callback: (value?: DeepPartial<Context>) => void) =>
      this.callbacks.context.register(callback),
    set: (value) => {
      this.data.context =
        value instanceof Function
          ? value(this.data.context ?? {})
          : { ...value };
      this.callbacks.context.run(this.data.context);
      return this.data.context;
    },
  };

  readonly settings: Watchable<HightouchAPIIntegrations | undefined> &
    Settable<HightouchAPIIntegrations> &
    Dictionary<string, IntegrationSettings, HightouchAPIIntegrations> = {
    get: createMockStoreGetter(() => this.data.settings),
    onChange: (callback: (value?: HightouchAPIIntegrations) => void) =>
      this.callbacks.settings.register(callback),
    set: (value) => {
      this.data.settings =
        value instanceof Function
          ? value(this.data.settings ?? {})
          : { ...value };
      this.callbacks.settings.run(this.data.settings);
      return this.data.settings;
    },
    add: (key: string, value: IntegrationSettings) => {
      this.data.settings[key] = value;
      this.callbacks.settings.run(this.data.settings);
      return Promise.resolve(this.data.settings);
    },
  };

  readonly consentSettings: Watchable<HightouchAPIConsentSettings | undefined> &
    Settable<HightouchAPIConsentSettings | undefined> = {
    get: createMockStoreGetter(() => this.data.consentSettings),
    onChange: (callback: (value?: HightouchAPIConsentSettings) => void) =>
      this.callbacks.consentSettings.register(callback),
    set: (value) => {
      this.data.consentSettings =
        value instanceof Function ? value(this.data.consentSettings) : value;
      this.callbacks.consentSettings.run(this.data.consentSettings);
      return this.data.consentSettings;
    },
  };

  readonly filters: Watchable<DestinationFilters | undefined> &
    Settable<DestinationFilters> &
    Dictionary<string, RoutingRule, DestinationFilters> = {
    get: createMockStoreGetter(() => this.data.filters),
    onChange: (callback: (value?: DestinationFilters) => void) =>
      this.callbacks.filters.register(callback),
    set: (value) => {
      this.data.filters =
        value instanceof Function
          ? value(this.data.filters ?? {})
          : { ...value };
      this.callbacks.filters.run(this.data.filters);
      return this.data.filters;
    },
    add: (key: string, value: RoutingRule) => {
      this.data.filters[key] = value;
      this.callbacks.filters.run(this.data.filters);
      return Promise.resolve(this.data.filters);
    },
  };

  readonly userInfo: Watchable<UserInfoState> & Settable<UserInfoState> = {
    get: createMockStoreGetter(() => this.data.userInfo),
    onChange: (callback: (value: UserInfoState) => void) =>
      this.callbacks.userInfo.register(callback),
    set: (value) => {
      this.data.userInfo =
        value instanceof Function
          ? value(this.data.userInfo ?? {})
          : { ...value };
      this.callbacks.userInfo.run(this.data.userInfo);
      return this.data.userInfo;
    },
  };

  readonly deepLinkData = {
    get: createMockStoreGetter(() => {
      return this.data.deepLinkData;
    }),
    set: (value: DeepLinkData) => {
      this.data.deepLinkData = value;
      this.callbacks.deepLinkData.run(value);
    },
    onChange: (callback: (value: DeepLinkData) => void) =>
      this.callbacks.deepLinkData.register(callback),
  };

  readonly pendingEvents: Watchable<HightouchEvent[]> &
    Settable<HightouchEvent[]> &
    Queue<HightouchEvent, HightouchEvent[]> = {
    get: createMockStoreGetter(() => {
      return this.data.pendingEvents;
    }),
    set: (value) => {
      this.data.pendingEvents =
        value instanceof Function
          ? value(this.data.pendingEvents ?? [])
          : [...value];
      this.callbacks.pendingEvents.run(this.data.pendingEvents);
      return this.data.pendingEvents;
    },
    add: (value: HightouchEvent) => {
      this.data.pendingEvents.push(value);
      this.callbacks.pendingEvents.run(this.data.pendingEvents);
      return Promise.resolve(this.data.pendingEvents);
    },
    remove: (value: HightouchEvent) => {
      this.data.pendingEvents = this.data.pendingEvents.filter(
        (e) => e.messageId != value.messageId
      );
      this.callbacks.pendingEvents.run(this.data.pendingEvents);
      return Promise.resolve(this.data.pendingEvents);
    },
    onChange: (callback: (value: HightouchEvent[]) => void) =>
      this.callbacks.pendingEvents.register(callback),
  };
}
