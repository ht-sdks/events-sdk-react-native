import type { Mixpanel } from 'mixpanel-react-native';
import {
  IdentifyEventType,
  generateMapTransform,
} from '@ht-sdks/events-sdk-react-native';
import type { HightouchMixpanelSettings } from '../types';

const traitMap: { [key: string]: string } = {
  firstName: '$first_name',
  lastName: '$last_name',
  createdAt: '$created',
  lastSeen: '$last_seen',
  email: '$email',
  name: '$name',
  username: '$username',
  phone: '$phone',
};

const mapTransform = generateMapTransform(traitMap, {});

export default (
  event: IdentifyEventType,
  mixpanel: Mixpanel,
  settings: HightouchMixpanelSettings
) => {
  const userId = event.userId;
  const mixpanelTraits = mapTransform(event.traits ?? {});

  if (userId !== undefined) {
    void mixpanel.identify(userId);
  }

  if (settings.setAllTraitsByDefault === true) {
    mixpanel.registerSuperProperties(mixpanelTraits);

    if (settings.people === true) {
      mixpanel.getPeople().set(mixpanelTraits);
    }
  }

  if (
    settings.superProperties !== undefined &&
    settings.superProperties.length
  ) {
    const superProperties = settings.superProperties;
    const superPropertyTraits: { [key: string]: unknown } = {};

    for (const superProperty of superProperties) {
      superPropertyTraits[superProperty] = mixpanelTraits[superProperty];
    }

    const mappedSuperProperties = mapTransform(superPropertyTraits);
    mixpanel.registerSuperProperties(mappedSuperProperties);
  }

  if (
    event.traits !== undefined &&
    settings.people === true &&
    settings.peopleProperties !== undefined &&
    settings.peopleProperties.length
  ) {
    const peopleProperties = settings.peopleProperties;
    const peoplePropertyTraits: { [key: string]: unknown } = {};

    for (const peopleProperty of peopleProperties) {
      peoplePropertyTraits[peopleProperty] = event.traits[peopleProperty];
    }

    const mappedPeopleProperties = mapTransform(peoplePropertyTraits);
    mixpanel.getPeople().set(mappedPeopleProperties);
  }
};
