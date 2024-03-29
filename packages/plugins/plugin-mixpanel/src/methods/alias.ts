import type { Mixpanel } from 'mixpanel-react-native';
import {
  AliasEventType,
  ErrorType,
  HightouchClient,
  HightouchError,
} from '@ht-sdks/events-sdk-react-native';

export default async (
  event: AliasEventType,
  mixpanel: Mixpanel,
  analytics: HightouchClient
) => {
  let distinctId = '';
  const newId = event.userId as string;

  try {
    distinctId = await mixpanel.getDistinctId();
  } catch (e) {
    analytics.reportInternalError(
      new HightouchError(ErrorType.PluginError, JSON.stringify(e), e)
    );
    analytics.logger.warn(e);
  }
  if (distinctId !== '') {
    mixpanel.alias(newId, distinctId);
  }
};
