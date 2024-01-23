import { createTestClient } from '../../../test-helpers';
import { ConsentPlugin } from '../../ConsentPlugin';
import destinationsMultipleCategories from './mockSettings/DestinationsMultipleCategories.json';
import {
  createConsentProvider,
  createHightouchWatcher,
  setupTestDestinations,
} from './utils';

// The Consent API is not currently supported.
describe.skip('Destinations multiple categories', () => {
  const createClient = () =>
    createTestClient(
      {
        settings: destinationsMultipleCategories.integrations,
        consentSettings: destinationsMultipleCategories.consentSettings,
      },
      { autoAddHightouchDestination: true }
    );

  test('no to all', async () => {
    const { client } = createClient();
    const testDestinations = setupTestDestinations(client);
    const mockConsentStatuses = {
      C0001: false,
      C0002: false,
      C0003: false,
      C0004: false,
      C0005: false,
    };

    client.add({
      plugin: new ConsentPlugin(
        createConsentProvider(mockConsentStatuses),
        Object.keys(mockConsentStatuses)
      ),
    });

    await client.init();

    const hightouchDestination = createHightouchWatcher(client);

    await client.track('test');

    expect(hightouchDestination).not.toHaveBeenCalled();
    expect(testDestinations.dest1.track).not.toHaveBeenCalled();
    expect(testDestinations.dest2.track).not.toHaveBeenCalled();
  });

  test('yes to 1', async () => {
    const { client } = createClient();
    const testDestinations = setupTestDestinations(client);
    const mockConsentStatuses = {
      C0001: true,
      C0002: false,
      C0003: false,
      C0004: false,
      C0005: false,
    };

    client.add({
      plugin: new ConsentPlugin(
        createConsentProvider(mockConsentStatuses),
        Object.keys(mockConsentStatuses)
      ),
    });

    await client.init();

    const hightouchDestination = createHightouchWatcher(client);

    await client.track('test');

    expect(hightouchDestination).toHaveBeenCalled();
    expect(testDestinations.dest1.track).not.toHaveBeenCalled();
    expect(testDestinations.dest2.track).toHaveBeenCalled();
  });

  test('yes to 2', async () => {
    const { client } = createClient();
    const testDestinations = setupTestDestinations(client);
    const mockConsentStatuses = {
      C0001: false,
      C0002: true,
      C0003: false,
      C0004: false,
      C0005: false,
    };

    client.add({
      plugin: new ConsentPlugin(
        createConsentProvider(mockConsentStatuses),
        Object.keys(mockConsentStatuses)
      ),
    });

    await client.init();

    const hightouchDestination = createHightouchWatcher(client);

    await client.track('test');

    expect(hightouchDestination).toHaveBeenCalled();
    expect(testDestinations.dest1.track).not.toHaveBeenCalled();
    expect(testDestinations.dest2.track).not.toHaveBeenCalled();
  });

  test('yes to all', async () => {
    const { client } = createClient();
    const testDestinations = setupTestDestinations(client);
    const mockConsentStatuses = {
      C0001: true,
      C0002: true,
      C0003: true,
      C0004: true,
      C0005: true,
    };

    client.add({
      plugin: new ConsentPlugin(
        createConsentProvider(mockConsentStatuses),
        Object.keys(mockConsentStatuses)
      ),
    });

    await client.init();

    const hightouchDestination = createHightouchWatcher(client);

    await client.track('test');

    expect(hightouchDestination).toHaveBeenCalled();
    expect(testDestinations.dest1.track).toHaveBeenCalled();
    expect(testDestinations.dest2.track).toHaveBeenCalled();
  });
});
