#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(AnalyticsReactNative, HtAnalyticsReactNative, NSObject)

RCT_EXTERN_METHOD(getContextInfo: (NSDictionary)configuration resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
