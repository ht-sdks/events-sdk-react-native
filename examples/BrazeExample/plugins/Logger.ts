import {
  Plugin,
  PluginType,
  HightouchEvent,
} from '@ht-sdks/events-sdk-react-native';

export class Logger extends Plugin {
  type = PluginType.before;

  execute(event: HightouchEvent) {
    if (__DEV__) {
      console.log(event);
    }
    return event;
  }
}
