import firebaseAnalytics from '@react-native-firebase/analytics';
import type { ScreenEventType } from '@ht-sdks/analytics-react-native';

export default async (event: ScreenEventType) => {
  const screenProps = {
    screen_name: event.name,
    screen_class: event.name,
    ...event.properties,
  };

  await firebaseAnalytics().logScreenView(screenProps);
};
