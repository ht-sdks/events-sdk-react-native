import type { Mixpanel } from 'mixpanel-react-native';
import type { GroupEventType } from '@ht-sdks/events-sdk-react-native';
import type { HightouchMixpanelSettings } from '../types';

export default (
  event: GroupEventType,
  mixpanel: Mixpanel,
  settings: HightouchMixpanelSettings
) => {
  const groupId = event.groupId;
  const groupTraits = settings.groupIdentifierTraits;

  if (groupTraits !== undefined) {
    for (const groupTrait of groupTraits) {
      for (const eventTrait in event.traits) {
        if (groupTrait.toLocaleLowerCase() === eventTrait.toLocaleLowerCase()) {
          const group = event.traits[groupTrait] as string;
          const traits = event.traits;

          mixpanel.getGroup(group, groupId).setOnce('properties', traits);
        }
      }
      mixpanel.setGroup(groupTrait, groupId);
    }
  }
};
