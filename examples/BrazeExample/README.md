# BrazeExample

Side-by-side sample for the Braze destination plugin. Install from this directory:

```sh
yarn
cd ios && pod install && cd ..
yarn ios
yarn android
```

The Hightouch write key is the `writeKey` placeholder in `App.tsx`.

## Braze API key

Braze is started natively. Do not put a Braze API key in JavaScript.

- Android: `android/app/src/main/res/values/braze.xml`. Replace `BRAZE_API_KEY`. The endpoint is `sdk.iad-03.braze.com`. `MainApplication` registers `BrazeActivityLifecycleCallbackListener`.
- iOS: `BrazeAPIKey` and `BrazeEndpoint` in `ios/AnalyticsReactNativeExample/Info.plist`. `AppDelegate` passes those keys to `BrazeReactBridge initBraze:`.

## perOrder

`perOrder` at the top of `App.tsx` defaults to `false`, so each product in an order is its own Braze purchase. Set it to `true` and reload to log one purchase per order.

## Appboy

`Appboy` must stay in `createClient` `defaultSettings.integrations`. Without it, the plugin never runs.

## Checking results

This sandbox has no Event User Log. Confirm identifies, custom events, screens, and purchases on the Braze user profile, and in native logs (Xcode console or `adb logcat`).
