import {
  DestinationPlugin,
  PluginType,
  TrackEventType,
  ScreenEventType,
  HightouchAPISettings,
  UpdateType,
  IdentifyEventType,
  GroupEventType,
  JsonMap,
  AliasEventType,
  HightouchError,
  ErrorType,
} from '@ht-sdks/events-sdk-react-native';
import type { HightouchMixpanelSettings } from './types';
import { Mixpanel } from 'mixpanel-react-native';
import identify from './methods/identify';
import screen from './methods/screen';
import group from './methods/group';
import alias from './methods/alias';
import track from './methods/track';

export const EU_SERVER = 'api.eu.mixpanel.com';
export class MixpanelPlugin extends DestinationPlugin {
  type = PluginType.destination;
  key = 'Mixpanel';
  trackScreens = false;
  private mixpanel: Mixpanel | undefined;
  private settings: HightouchMixpanelSettings | undefined;
  private isInitialized = () =>
    this.mixpanel !== undefined && this.settings !== undefined;

  update(settings: HightouchAPISettings, _: UpdateType) {
    const mixpanelSettings = settings.integrations[
      this.key
    ] as HightouchMixpanelSettings;

    if (mixpanelSettings === undefined || this.mixpanel !== undefined) {
      return;
    }
    if (mixpanelSettings.token.length === 0) {
      return;
    }
    this.mixpanel = new Mixpanel(mixpanelSettings.token, false);
    this.mixpanel.init().catch((error) => {
      this.analytics?.reportInternalError(
        new HightouchError(
          ErrorType.PluginError,
          'Error initializing Mixpanel',
          error
        )
      );
    });
    this.settings = mixpanelSettings;

    if (mixpanelSettings.enableEuropeanEndpoint === true) {
      this.mixpanel?.setServerURL(EU_SERVER);
    }
  }

  identify(event: IdentifyEventType) {
    if (this.isInitialized()) {
      identify(event, this.mixpanel!, this.settings!);
    }
    return event;
  }

  track(event: TrackEventType) {
    const eventName = event.event;
    const properties = event.properties as JsonMap;

    if (this.isInitialized()) {
      track(eventName, properties, this.settings!, this.mixpanel!);
    }
    return event;
  }

  screen(event: ScreenEventType) {
    if (this.isInitialized()) {
      screen(event, this.mixpanel!, this.settings!);
    }
    return event;
  }

  group(event: GroupEventType) {
    if (this.isInitialized()) {
      group(event, this.mixpanel!, this.settings!);
    }
    return event;
  }

  async alias(event: AliasEventType) {
    if (this.mixpanel !== undefined && this.analytics !== undefined) {
      await alias(event, this.mixpanel, this.analytics);
    }
    return event;
  }

  flush(): void {
    this.mixpanel?.flush();
  }

  reset(): void {
    this.mixpanel?.reset();
  }
}
