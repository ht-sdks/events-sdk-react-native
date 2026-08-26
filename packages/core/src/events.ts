import {
  GroupEventType,
  GroupTraits,
  IdentifyEventType,
  JsonMap,
  ScreenEventType,
  TrackEventType,
  UserTraits,
  AliasEventType,
  EventType,
  PartialContext,
} from './types';

export const createTrackEvent = ({
  event,
  properties = {},
  context,
}: {
  event: string;
  properties?: JsonMap;
  context?: JsonMap;
}): TrackEventType => ({
  type: EventType.TrackEvent,
  event,
  properties,
  ...(context !== undefined ? { context: context as PartialContext } : {}),
});

export const createScreenEvent = ({
  name,
  properties = {},
  context,
}: {
  name: string;
  properties?: JsonMap;
  context?: JsonMap;
}): ScreenEventType => ({
  type: EventType.ScreenEvent,
  name,
  properties,
  ...(context !== undefined ? { context: context as PartialContext } : {}),
});

export const createIdentifyEvent = ({
  userId,
  userTraits = {},
  context,
}: {
  userId?: string;
  userTraits?: UserTraits;
  context?: JsonMap;
}): IdentifyEventType => {
  return {
    type: EventType.IdentifyEvent,
    userId: userId,
    traits: userTraits,
    ...(context !== undefined ? { context: context as PartialContext } : {}),
  };
};

export const createGroupEvent = ({
  groupId,
  groupTraits = {},
  context,
}: {
  groupId: string;
  groupTraits?: GroupTraits;
  context?: JsonMap;
}): GroupEventType => ({
  type: EventType.GroupEvent,
  groupId,
  traits: groupTraits,
  ...(context !== undefined ? { context: context as PartialContext } : {}),
});

export const createAliasEvent = ({
  anonymousId,
  userId,
  newUserId,
  context,
}: {
  anonymousId: string;
  userId?: string;
  newUserId: string;
  context?: JsonMap;
}): AliasEventType => ({
  type: EventType.AliasEvent,
  userId: newUserId,
  previousId: userId ?? anonymousId,
  ...(context !== undefined ? { context: context as PartialContext } : {}),
});
