import { HightouchClient } from '../../analytics';
import { settingsCDN } from '../../constants';
import { HIGHTOUCH_DESTINATION_KEY } from '../../plugins/HightouchDestination';
import { getMockLogger, MockHightouchStore } from '../../test-helpers';

describe('internal #getSettings', () => {
  const defaultIntegrationSettings = {
    integrations: {
      // Make sure the value associated with this key here is different
      // from the initial value in `store.settings` as set by the mock store.
      // Otherwise we can't actually test that default settings are set correctly
      // i.e. tests that should fail could misleadingly appear to succeed.
      [HIGHTOUCH_DESTINATION_KEY]: { apiKey: 'bar', apiHost: 'boo' },
    },
  };
  const store = new MockHightouchStore();

  const clientArgs = {
    config: {
      writeKey: '123-456',
      defaultSettings: defaultIntegrationSettings,
      flushInterval: 0,
    },
    logger: getMockLogger(),
    store: store,
  };

  const client = new HightouchClient(clientArgs);

  const setSettingsSpy = jest.spyOn(store.settings, 'set');

  beforeEach(() => {
    store.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the settings succesfully ', async () => {
    const mockJSONResponse = { integrations: { foo: 'bar' } };
    const mockResponse = Promise.resolve({
      ok: true,
      json: () => mockJSONResponse,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve(mockResponse));

    await client.fetchSettings();

    expect(fetch).toHaveBeenCalledWith(
      `${settingsCDN}/${clientArgs.config.writeKey}/settings`
    );

    expect(setSettingsSpy).toHaveBeenCalledWith(mockJSONResponse.integrations);
    expect(store.settings.get()).toEqual(mockJSONResponse.integrations);
    expect(client.settings.get()).toEqual(mockJSONResponse.integrations);
  });

  it('fails to the settings succesfully and uses the default if specified', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.reject());

    await client.fetchSettings();

    expect(fetch).toHaveBeenCalledWith(
      `${settingsCDN}/${clientArgs.config.writeKey}/settings`
    );

    expect(setSettingsSpy).toHaveBeenCalledWith(
      defaultIntegrationSettings.integrations
    );
    expect(store.settings.get()).toEqual(
      defaultIntegrationSettings.integrations
    );
    expect(client.settings.get()).toEqual(
      defaultIntegrationSettings.integrations
    );
  });

  it('fails to the settings succesfully and has no default settings', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.reject());
    const anotherClient = new HightouchClient({
      ...clientArgs,
      config: { ...clientArgs.config, defaultSettings: undefined },
    });

    await anotherClient.fetchSettings();

    expect(fetch).toHaveBeenCalledWith(
      `${settingsCDN}/${clientArgs.config.writeKey}/settings`
    );
    expect(setSettingsSpy).not.toHaveBeenCalled();
  });

  it('fails to the settings succesfully and has no default settings for soft API errors', async () => {
    const mockResponse = Promise.resolve({
      ok: false,
      status: 500,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve(mockResponse));
    const anotherClient = new HightouchClient({
      ...clientArgs,
      config: { ...clientArgs.config, defaultSettings: undefined },
    });

    await anotherClient.fetchSettings();

    expect(fetch).toHaveBeenCalledWith(
      `${settingsCDN}/${clientArgs.config.writeKey}/settings`
    );
    expect(setSettingsSpy).not.toHaveBeenCalled();
  });
});
