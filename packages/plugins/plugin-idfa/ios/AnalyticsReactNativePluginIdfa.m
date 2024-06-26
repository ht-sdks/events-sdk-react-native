#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(HtAnalyticsReactNativePluginIdfa, RCTEventEmitter)

RCT_EXTERN_METHOD(
                  getTrackingAuthorizationStatus: (RCTPromiseResolveBlock)resolve
                  rejecter: (RCTPromiseRejectBlock)reject
                  )

@end
