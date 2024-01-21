import type { Mixpanel } from 'mixpanel-react-native';
import type { ScreenEventType, JsonMap } from '@ht-sdks/analytics-react-native';
import type { HightouchMixpanelSettings } from '../types';

import track from './track';

export default (
  event: ScreenEventType,
  mixpanel: Mixpanel,
  settings: HightouchMixpanelSettings
) => {
  const callTrack = (eventName: string, properties: JsonMap) => {
    track(eventName, properties, settings, mixpanel);
  };
  const properties = event.properties;

  if (settings.consolidatedPageCalls === true) {
    const eventName = 'Loaded a Screen';
    const screenName = event.name;

    if (screenName !== undefined) {
      properties.name = screenName;
    }

    callTrack(eventName, properties);
  } else if (settings.trackAllPages === true) {
    const eventName = `Viewed ${event.name} Screen`;

    callTrack(eventName, properties);
  } else if (settings.trackNamedPages === true && event.name !== undefined) {
    const eventName = `Viewed ${event.name} Screen`;

    callTrack(eventName, properties);
  } else if (
    settings.trackCategorizedPages === true &&
    event.properties?.category !== undefined
  ) {
    const category = event.properties.category;
    const eventName = `Viewed ${category?.toString() ?? ''} Screen`;

    callTrack(eventName, properties);
  }
};
