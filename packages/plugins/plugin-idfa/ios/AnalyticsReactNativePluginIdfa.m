#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_REMAP_MODULE(AnalyticsReactNativePluginIdfa, HtAnalyticsReactNativePluginIdfa, RCTEventEmitter)

RCT_EXTERN_METHOD(
                  getTrackingAuthorizationStatus: (RCTPromiseResolveBlock)resolve
                  rejecter: (RCTPromiseRejectBlock)reject
                  )

@end
