import { Adjust } from 'react-native-adjust';
import type { IdentifyEventType } from '@ht-sdks/events-sdk-react-native';

export default (event: IdentifyEventType) => {
  const userId = event.userId;
  if (userId !== undefined && userId !== null && userId.length > 0) {
    Adjust.addSessionPartnerParameter('user_id', userId);
  }

  const anonId = event.anonymousId;
  if (anonId !== undefined && anonId !== null && anonId.length > 0) {
    Adjust.addSessionPartnerParameter('anonymous_id', anonId);
  }
};
