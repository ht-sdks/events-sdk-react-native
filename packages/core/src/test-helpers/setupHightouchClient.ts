import { HightouchClient } from '../analytics';
import { UtilityPlugin } from '../plugin';
import { Config, PluginType, HightouchEvent } from '../types';
import { getMockLogger } from './mockLogger';
import { MockHightouchStore, StoreData } from './mockHightouchStore';

jest
  .spyOn(Date.prototype, 'toISOString')
  .mockReturnValue('2010-01-01T00:00:00.000Z');

export const createTestClient = (
  storeData?: Partial<StoreData>,
  config?: Partial<Config>
) => {
  const store = new MockHightouchStore({
    isReady: true,
    ...storeData,
  });

  const clientArgs = {
    config: {
      writeKey: 'mock-write-key',
      autoAddHightouchDestination: false,
      flushInterval: 0,
      ...config,
    },
    logger: getMockLogger(),
    store: store,
  };

  const client = new HightouchClient(clientArgs);
  class ObservablePlugin extends UtilityPlugin {
    type = PluginType.after;

    execute = async (
      event: HightouchEvent
    ): Promise<HightouchEvent | undefined> => {
      await super.execute(event);
      return event;
    };
  }

  const mockPlugin = new ObservablePlugin();
  jest.spyOn(mockPlugin, 'execute');

  client.add({ plugin: mockPlugin });

  return {
    client,
    store,
    plugin: mockPlugin as UtilityPlugin,
    expectEvent: (event: Partial<HightouchEvent>) => {
      return expect(mockPlugin.execute).toHaveBeenCalledWith(
        expect.objectContaining(event)
      );
    },
  };
};
