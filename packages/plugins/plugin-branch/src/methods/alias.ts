import Branch from 'react-native-branch';
import type { AliasEventType } from '@ht-sdks/events-sdk-react-native';

export default (event: AliasEventType) => {
  const userId = event.userId;
  if (userId !== undefined) {
    Branch.setIdentity(userId);
  }
};
