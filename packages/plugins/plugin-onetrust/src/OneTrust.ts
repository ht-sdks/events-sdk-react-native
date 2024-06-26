import { ConsentPlugin } from '@ht-sdks/events-sdk-react-native';

import { OTPublishersNativeSDK, OTCategoryConsentProvider } from './OTProvider';

export class OneTrustPlugin extends ConsentPlugin {
  constructor(oneTrustSDK: OTPublishersNativeSDK, categories: string[]) {
    super(new OTCategoryConsentProvider(oneTrustSDK), categories);
  }
}
