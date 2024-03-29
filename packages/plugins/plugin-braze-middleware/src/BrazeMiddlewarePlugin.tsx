import {
  Plugin,
  PluginType,
  UserInfoState,
  HightouchEvent,
  EventType,
} from '@ht-sdks/events-sdk-react-native';

export class BrazeMiddlewarePlugin extends Plugin {
  type = PluginType.before;
  key = 'Appboy';
  private lastSeenTraits: UserInfoState | undefined = undefined;

  execute(event: HightouchEvent): HightouchEvent | undefined {
    //check to see if anything has changed
    //if it hasn't changed disable integration
    if (event.type === EventType.IdentifyEvent) {
      if (
        this.lastSeenTraits?.userId === event.userId &&
        this.lastSeenTraits?.anonymousId === event.anonymousId &&
        this.lastSeenTraits?.traits === event.traits
      ) {
        const integrations = event.integrations;

        if (integrations !== undefined) {
          integrations[this.key] = false;
        }
      } else {
        this.lastSeenTraits = {
          anonymousId: event.anonymousId ?? '',
          userId: event.userId,
          traits: event.traits,
        };
      }
    }
    return event;
  }
}
