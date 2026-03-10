export * from './persistor';
export { AsyncStoragePersistor } from './async-storage-persistor';
export { createMMKVPersistor, isMMKVAvailable } from './mmkv-persistor';
import type { Persistor } from './persistor';
import { createMMKVPersistor, isMMKVAvailable } from './mmkv-persistor';
import { AsyncStoragePersistor } from './async-storage-persistor';

let hasShownFallbackWarning = false;

/**
 * Creates the default persistor for the SDK.
 *
 * Uses MMKV when available (iOS, Android, Web) for synchronous writes via JSI,
 * which eliminates the race condition where events can be lost if the app
 * terminates before async writes complete.
 *
 * Falls back to AsyncStorage for desktop platforms (macOS, Windows) where
 * MMKV is not supported. See platform support:
 * https://github.com/mrousavy/react-native-mmkv#supported-platforms
 */
export function createDefaultPersistor(): Persistor {
  if (isMMKVAvailable()) {
    try {
      return createMMKVPersistor();
    } catch {
      // Fall through to AsyncStorage
    }
  }

  // Warn once when falling back to AsyncStorage
  if (!hasShownFallbackWarning) {
    console.warn(
      "Hightouch: react-native-mmkv not available, using AsyncStorage.\n" +
        "For synchronous persistence (recommended), install 'react-native-mmkv'.\n" +
        "This warning will only show once."
    );
    hasShownFallbackWarning = true;
  }

  return AsyncStoragePersistor;
}
