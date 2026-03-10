import type { AsyncPersistor, SyncPersistor } from '..';
import { PersistorType } from '..';
import { createStore, Store, StoreConfig } from '../store';

interface Event {
  id: string;
  description: string;
}

type EventStore = { events: Event[] };

describe('Persistor Types', () => {
  const getMockSyncPersistor = <T>(initialState: T): SyncPersistor => {
    return {
      type: PersistorType.SYNC,
      get: jest.fn().mockReturnValue(initialState),
      set: jest.fn(),
    };
  };

  const getMockAsyncPersistor = <T>(initialState: T): AsyncPersistor => {
    return {
      type: PersistorType.ASYNC,
      get: jest.fn().mockResolvedValue(initialState),
      set: jest.fn().mockResolvedValue(undefined),
    };
  };

  const getAwaitableSovranConstructor = async <T extends object>(
    initialState: T,
    config: StoreConfig
  ): Promise<{ store: Store<T>; onInitializedState: T }> => {
    return await new Promise((resolve) => {
      let capturedState: T | undefined;
      const store: Store<T> = createStore<T>(initialState, {
        ...config,
        persist: {
          storeId: 'test',
          ...config.persist,
          onInitialized: (state) => {
            capturedState = state as T;
            // Use queueMicrotask to defer resolution until after store assignment
            queueMicrotask(() =>
              resolve({ store, onInitializedState: capturedState! })
            );
          },
        },
      });
    });
  };

  describe('Sync Persistor (MMKV)', () => {
    it('calls set() synchronously without setTimeout', async () => {
      const ID = 'syncTest';

      const persistedEvent: Event = {
        id: '0',
        description: 'myPersistedEvent',
      };

      const persistedState = { events: [persistedEvent] };

      const mockPersistor = getMockSyncPersistor(persistedState);

      const { store } = await getAwaitableSovranConstructor<EventStore>(
        { events: [] },
        {
          persist: {
            storeId: ID,
            persistor: mockPersistor,
          },
        }
      );

      expect(store.getState()).toEqual(persistedState);
      expect(mockPersistor.get).toHaveBeenCalledTimes(1);

      const sampleEvent: Event = {
        id: '1',
        description: 'test',
      };

      const expectedState = {
        events: [persistedEvent, sampleEvent],
      };

      await store.dispatch((state) => {
        return {
          events: [...state.events, sampleEvent],
        };
      });

      expect(store.getState()).toEqual(expectedState);

      // Sync persistor should call set() immediately
      expect(mockPersistor.set).toHaveBeenCalledWith(ID, expectedState);
    });

    it('handles errors in sync set() gracefully', async () => {
      const ID = 'errorTest';

      const persistedState = { events: [] };

      const mockPersistor: SyncPersistor = {
        type: PersistorType.SYNC,
        get: jest.fn().mockReturnValue(persistedState),
        set: jest.fn().mockImplementation(() => {
          throw new Error('Sync write failed');
        }),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      try {
        const { store } = await getAwaitableSovranConstructor<EventStore>(
          { events: [] },
          {
            persist: {
              storeId: ID,
              persistor: mockPersistor,
            },
          }
        );

        const sampleEvent: Event = {
          id: '1',
          description: 'test',
        };

        // Should not throw even though set() throws
        await store.dispatch((state) => {
          return {
            events: [...state.events, sampleEvent],
          };
        });

        expect(mockPersistor.set).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Async Persistor (AsyncStorage)', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debounces writes using saveDelay', async () => {
      const ID = 'asyncTest';
      const INTERVAL = 5000;

      const persistedEvent: Event = {
        id: '0',
        description: 'myPersistedEvent',
      };

      const persistedState = { events: [persistedEvent] };

      const mockPersistor = getMockAsyncPersistor(persistedState);

      const { store } = await getAwaitableSovranConstructor<EventStore>(
        { events: [] },
        {
          persist: {
            storeId: ID,
            saveDelay: INTERVAL,
            persistor: mockPersistor,
          },
        }
      );

      expect(store.getState()).toEqual(persistedState);

      const sampleEvent: Event = {
        id: '1',
        description: 'test',
      };

      const expectedState = {
        events: [persistedEvent, sampleEvent],
      };

      await store.dispatch((state) => {
        return {
          events: [...state.events, sampleEvent],
        };
      });

      // set() should NOT be called immediately for async persistor
      expect(mockPersistor.set).not.toHaveBeenCalledWith(ID, expectedState);

      // Advance timers to trigger the debounced save
      jest.advanceTimersByTime(INTERVAL);

      // Now set() should be called
      expect(mockPersistor.set).toHaveBeenCalledWith(ID, expectedState);
    });

    it('handles errors in async set() gracefully', async () => {
      // This test uses the fake timers from beforeEach
      const ID = 'asyncErrorTest';

      const persistedState = { events: [] };

      const mockPersistor: AsyncPersistor = {
        type: PersistorType.ASYNC,
        get: jest.fn().mockResolvedValue(persistedState),
        set: jest.fn().mockRejectedValue(new Error('Async write failed')),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      try {
        const { store } = await getAwaitableSovranConstructor<EventStore>(
          { events: [] },
          {
            persist: {
              storeId: ID,
              saveDelay: 0,
              persistor: mockPersistor,
            },
          }
        );

        const sampleEvent: Event = {
          id: '1',
          description: 'test',
        };

        await store.dispatch((state) => {
          return {
            events: [...state.events, sampleEvent],
          };
        });

        // Trigger the setTimeout (saveDelay: 0)
        jest.advanceTimersByTime(0);

        // Wait for the async error to be caught
        await Promise.resolve();
        await Promise.resolve();

        expect(mockPersistor.set).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
