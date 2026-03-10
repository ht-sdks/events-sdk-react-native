import { type SyncPersistor, PersistorType } from './persistor';

/**
 * MMKV version compatibility:
 * - v2.x: Uses `new MMKV({ id })` constructor - COMPATIBLE
 * - v3.x: Uses `new MMKV({ id })` constructor - COMPATIBLE
 * - v4.x: Uses `createMMKV()` factory function - NOT COMPATIBLE
 *
 * The peerDependency constraint ">=2.12.0 <4.0.0" allows v2 and v3.
 */

type MMKV = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

type MMKVConstructor = new (config: { id: string }) => MMKV;

let MMKVClass: MMKVConstructor | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mmkvModule = require('react-native-mmkv');
  MMKVClass = mmkvModule?.MMKV ?? mmkvModule?.default?.MMKV ?? null;
} catch {
  MMKVClass = null;
}

/**
 * Creates a Persistor implementation using MMKV for synchronous writes.
 * MMKV uses JSI to write synchronously, eliminating the race condition where
 * events can be lost if the app terminates before async writes complete.
 *
 * @throws Error if MMKV is not available (use isMMKVAvailable() to check first)
 */
export function createMMKVPersistor(): SyncPersistor {
  // Don't warn here - only throw. Warning belongs in createDefaultPersistor
  // fallback path, not in a factory that explicitly throws on failure.
  if (MMKVClass === null) {
    throw new Error('react-native-mmkv is not available');
  }

  const storage = new MMKVClass({ id: 'hightouch-sovran-store' });

  return {
    type: PersistorType.SYNC,

    get: <T>(key: string): T | undefined => {
      try {
        const value = storage.getString(key);
        if (value !== undefined) {
          return JSON.parse(value) as T;
        }
      } catch (e) {
        console.error('MMKVPersistor.get error:', e);
      }
      return undefined;
    },

    set: <T>(key: string, state: T): void => {
      try {
        storage.set(key, JSON.stringify(state));
      } catch (e) {
        console.error('MMKVPersistor.set error:', e);
      }
    },
  };
}

/**
 * Check if MMKV is available on this platform.
 * MMKV supports iOS, Android, and Web but NOT macOS or Windows.
 */
export function isMMKVAvailable(): boolean {
  return MMKVClass !== null;
}
