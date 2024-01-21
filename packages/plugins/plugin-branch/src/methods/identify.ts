import Branch from 'react-native-branch';
import type { IdentifyEventType } from '@ht-sdks/analytics-react-native';

export default (event: IdentifyEventType) => {
  const userId = event.userId;
  if (userId !== undefined) {
    Branch.setIdentity(userId);
  }
};
