#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import "BrazeReactBridge.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"AnalyticsReactNativeExample";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  NSString *apiKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"BrazeAPIKey"];
  NSString *endpoint = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"BrazeEndpoint"];
  BRZConfiguration *configuration = [[BRZConfiguration alloc] initWithApiKey:apiKey endpoint:endpoint];
  [BrazeReactBridge initBraze:configuration];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
