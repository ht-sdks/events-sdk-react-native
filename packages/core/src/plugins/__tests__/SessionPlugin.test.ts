import { AppState, AppStateStatus } from 'react-native';

import { createTestClient } from '../../test-helpers';
import type { HightouchClient } from '../../analytics';
import type { UtilityPlugin } from '../../plugin';
import type { MockHightouchStore } from '../../test-helpers';
import { SessionPlugin } from '../session/SessionPlugin';

jest.mock('react-native');
jest.mock('../../context');
jest.mock('uuid');

describe('SessionPlugin', () => {
  let client: HightouchClient;
  let store: MockHightouchStore;
  let plugin: UtilityPlugin;
  let appStateListeners: Array<(state: AppStateStatus) => void>;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    appStateListeners = [];
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        (_event, callback: (state: AppStateStatus) => void) => {
          appStateListeners.push(callback);
          return { remove: jest.fn() };
        }
      );
  });

  afterEach(() => {
    client?.cleanup();
    store?.reset();
    dateNowSpy.mockRestore();
    jest.clearAllMocks();
  });

  const setupClient = async () => {
    const stuff = createTestClient(undefined, {
      foregroundSessionTimeout: 2000,
      backgroundSessionTimeout: 2000,
    });
    client = stuff.client;
    store = stuff.store;
    plugin = stuff.plugin;
    await client.init();
  };

  it('adds session context to every event', async () => {
    await setupClient();

    await client.track('First Event');
    dateNowSpy.mockReturnValue(1500);
    await client.track('Second Event');

    expect(plugin.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        context: expect.objectContaining({
          sessionId: 1000,
          sessionStart: true,
          session: expect.objectContaining({
            sessionId: 1000,
            sessionIndex: 0,
            sessionStart: true,
            eventIndex: 0,
            previousSessionId: null,
            firstEventId: 'mocked-uuid',
            firstEventTimestamp: '2010-01-01T00:00:00.000Z',
          }),
        }),
      })
    );
    expect(plugin.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: expect.objectContaining({
          sessionId: 1000,
          session: expect.objectContaining({
            eventIndex: 1,
          }),
        }),
      })
    );
    expect(
      (plugin.execute as jest.Mock).mock.calls[1][0].context.sessionStart
    ).toBeUndefined();
  });

  it('rotates on foreground inactivity', async () => {
    await setupClient();

    await client.track('First Event');
    dateNowSpy.mockReturnValue(3001);
    await client.track('Rotated Event');

    expect(plugin.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          sessionId: 3001,
          sessionStart: true,
          session: expect.objectContaining({
            sessionId: 3001,
            sessionIndex: 1,
            previousSessionId: 1000,
            eventIndex: 0,
          }),
        }),
      })
    );
  });

  it('rotates after the app spends longer than the background timeout away', async () => {
    await setupClient();

    await client.track('First Event');
    dateNowSpy.mockReturnValue(1500);
    appStateListeners.forEach((listener) => listener('background'));
    await Promise.resolve();

    dateNowSpy.mockReturnValue(4000);
    appStateListeners.forEach((listener) => listener('active'));
    await Promise.resolve();

    await client.track('Foreground Event');

    expect(plugin.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          session: expect.objectContaining({
            sessionId: 4000,
            sessionIndex: 1,
            previousSessionId: 1000,
            firstEventId: 'mocked-uuid',
          }),
        }),
      })
    );
  });

  it('preserves the background timestamp when events are processed while backgrounded', async () => {
    await setupClient();

    await client.track('First Event');
    dateNowSpy.mockReturnValue(1500);
    appStateListeners.forEach((listener) => listener('background'));
    await Promise.resolve();

    dateNowSpy.mockReturnValue(1501);
    await client.track('Application Backgrounded');

    dateNowSpy.mockReturnValue(4000);
    appStateListeners.forEach((listener) => listener('active'));
    await Promise.resolve();

    await client.track('Foreground Event');

    expect(plugin.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          session: expect.objectContaining({
            sessionId: 4000,
            sessionIndex: 1,
            sessionStart: true,
            eventIndex: 0,
            previousSessionId: 1000,
          }),
        }),
      })
    );
  });

  it('rotates when the client resets', async () => {
    await setupClient();

    await client.track('First Event');
    dateNowSpy.mockReturnValue(5000);
    await client.reset();
    await client.track('After Reset');

    expect(plugin.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          session: expect.objectContaining({
            sessionId: 5000,
            sessionIndex: 1,
            sessionStart: true,
            previousSessionId: 1000,
            firstEventId: 'mocked-uuid',
          }),
        }),
      })
    );
  });

  it('does not register or enrich when both timeouts are zero', async () => {
    const stuff = createTestClient(undefined, {
      foregroundSessionTimeout: 0,
      backgroundSessionTimeout: 0,
    });
    client = stuff.client;
    store = stuff.store;
    plugin = stuff.plugin;

    await client.init();
    await client.track('No Session Event');

    expect(
      client
        .getPlugins()
        .some((loadedPlugin) => loadedPlugin instanceof SessionPlugin)
    ).toBe(false);
    expect(
      (plugin.execute as jest.Mock).mock.calls[0][0].context.session
    ).toBeUndefined();
    expect(
      (plugin.execute as jest.Mock).mock.calls[0][0].context.sessionId
    ).toBeUndefined();
  });
});
