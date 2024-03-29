import { HightouchClient } from '@ht-sdks/events-sdk-react-native';
import {
  getMockLogger,
  MockHightouchStore,
} from '@ht-sdks/events-sdk-react-native/src/test-helpers';

import { MixpanelPlugin } from '../../MixpanelPlugin';
import { Mixpanel } from '../__mocks__/mixpanel-react-native';
import alias from '../alias';

import type { AliasEventType } from '@ht-sdks/events-sdk-react-native';
jest.mock('mixpanel-react-native');

describe('#alias', () => {
  const store = new MockHightouchStore();
  const clientArgs = {
    logger: getMockLogger(),
    config: {
      writeKey: '123-456',
      trackApplicationLifecycleEvents: true,
      flushInterval: 0,
    },
    store,
  };
  let plugin: MixpanelPlugin = new MixpanelPlugin();

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new MixpanelPlugin();
    plugin.analytics = new HightouchClient(clientArgs);
  });

  it('calls the alias method', async () => {
    const payload = {
      type: 'alias',
      userId: '123',
    } as AliasEventType;
    const mixpanel = new Mixpanel('123');
    const analytics = plugin.analytics!;

    await alias(payload, mixpanel, analytics);

    expect(mixpanel.getDistinctId).toBeCalled();
    // need to fix this one
    // expect(mixpanel.alias).toBeCalled();
  });
});
