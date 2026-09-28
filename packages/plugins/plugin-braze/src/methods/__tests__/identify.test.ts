import {
  changeUser,
  setFirstName,
  setCountry,
  setPhoneNumber,
  setDateOfBirth,
  setLastName,
  setEmail,
  setGender,
  setHomeCity,
  setCustomUserAttribute,
  unsetCustomUserAttribute,
  setEmailNotificationSubscriptionType,
  setPushNotificationSubscriptionType,
} from '../__mocks__/@braze/react-native-sdk';
import type {
  HightouchClient,
  IdentifyEventType,
} from '@ht-sdks/events-sdk-react-native';
import { BrazePlugin } from '../../BrazePlugin';

describe('#identify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls correct methods #1', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        firstName: 'John',
        phone: '(555) 555-5555',
        foo: 'bar',
      },
      userId: 'user',
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(changeUser).toHaveBeenCalledWith('user');
    expect(setFirstName).toHaveBeenCalledWith('John');
    expect(setPhoneNumber).toHaveBeenCalledWith('(555) 555-5555');
    expect(setCustomUserAttribute).toHaveBeenCalledWith('foo', 'bar');
  });

  it('calls correct methods #2', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        lastName: 'Smith',
        birthday: 'Saturday February 29, 20',
        address: {
          city: 'Denver',
        },
      },
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(setDateOfBirth).toHaveBeenCalledWith(2020, 2, 29);
    expect(setLastName).toHaveBeenCalledWith('Smith');
    expect(setHomeCity).toHaveBeenCalledWith('Denver');
  });

  it('handles invalid dates gracefully', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        lastName: 'Smith',
        birthday: 'not a valid date',
        address: {
          city: 'Denver',
        },
      },
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(setDateOfBirth).not.toHaveBeenCalled();
    expect(setLastName).toHaveBeenCalledWith('Smith');
    expect(setHomeCity).toHaveBeenCalledWith('Denver');
  });

  it('calls correct methods #3', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        gender: 'o',
        email: 'test@test.com',
        address: {
          country: 'US',
        },
      },
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(setEmail).toHaveBeenCalledWith('test@test.com');
    expect(setGender).toHaveBeenCalledWith('o');
    expect(setCountry).toHaveBeenCalledWith('US');
  });

  it('only calls setGender with defined values', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        gender: 'robot',
      },
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(setGender).not.toHaveBeenCalled();
  });

  it('normalizes gender values', async () => {
    const plugin = new BrazePlugin();

    await plugin.identify({
      traits: { gender: 'Female' },
    } as unknown as IdentifyEventType);

    expect(setGender).toHaveBeenCalledWith('f');
  });

  it('accepts mParticle trait names', async () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'identify',
      traits: {
        first_name: 'John',
        $LastName: 'Smith',
        Email: 'test@test.com',
        $Mobile: '555',
        $Gender: 'm',
        dob: '1990-05-01',
        home_city: 'Denver',
        $Country: 'US',
        $Zip: '80202',
        email_subscribe: 'opted_in',
        push_subscribe: 'bogus',
      },
    };

    await plugin.identify(payload as IdentifyEventType);

    expect(setFirstName).toHaveBeenCalledWith('John');
    expect(setLastName).toHaveBeenCalledWith('Smith');
    expect(setEmail).toHaveBeenCalledWith('test@test.com');
    expect(setPhoneNumber).toHaveBeenCalledWith('555');
    expect(setGender).toHaveBeenCalledWith('m');
    expect(setDateOfBirth).toHaveBeenCalledWith(1990, 5, 1);
    expect(setHomeCity).toHaveBeenCalledWith('Denver');
    expect(setCountry).toHaveBeenCalledWith('US');
    expect(setCustomUserAttribute).toHaveBeenCalledWith('Zip', '80202');
    expect(setEmailNotificationSubscriptionType).toHaveBeenCalledWith(
      'optedin'
    );
    expect(setPushNotificationSubscriptionType).not.toHaveBeenCalled();
    expect(setCustomUserAttribute).toHaveBeenCalledTimes(1);
  });

  it('maps address.postalCode to Zip and age to date of birth', async () => {
    const plugin = new BrazePlugin();

    await plugin.identify({
      traits: { age: 30, address: { postalCode: '80202' } },
    } as unknown as IdentifyEventType);

    expect(setDateOfBirth).toHaveBeenCalledWith(
      new Date().getFullYear() - 30,
      1,
      1
    );
    expect(setCustomUserAttribute).toHaveBeenCalledWith('Zip', '80202');
  });

  it('formats custom attributes', async () => {
    const plugin = new BrazePlugin();

    await plugin.identify({
      traits: {
        $plan: 'gold',
        tags: ['a', 1],
        meta: { a: 1 },
        removed: null,
        skipped: undefined,
      },
    } as unknown as IdentifyEventType);

    expect(setCustomUserAttribute).toHaveBeenCalledWith('plan', 'gold');
    expect(setCustomUserAttribute).toHaveBeenCalledWith('tags', ['a', '1']);
    expect(setCustomUserAttribute).toHaveBeenCalledWith('meta', '{"a":1}');
    expect(unsetCustomUserAttribute).toHaveBeenCalledWith('removed');
    expect(setCustomUserAttribute).toHaveBeenCalledTimes(3);
  });

  it('stringifies attribute values when stringifyAttributeValues is on', async () => {
    const plugin = new BrazePlugin({ stringifyAttributeValues: true });

    await plugin.identify({
      traits: { visits: 3, member: true },
    } as unknown as IdentifyEventType);

    expect(setCustomUserAttribute).toHaveBeenCalledWith('visits', '3');
    expect(setCustomUserAttribute).toHaveBeenCalledWith('member', 'true');
  });

  it('only sends attributes that changed', async () => {
    const plugin = new BrazePlugin();

    await plugin.identify({
      userId: 'user',
      traits: { email: 'a@test.com', plan: 'gold' },
    } as unknown as IdentifyEventType);
    jest.clearAllMocks();
    await plugin.identify({
      userId: 'user',
      traits: { email: 'a@test.com', plan: 'silver' },
    } as unknown as IdentifyEventType);

    expect(changeUser).not.toHaveBeenCalled();
    expect(setEmail).not.toHaveBeenCalled();
    expect(setCustomUserAttribute).toHaveBeenCalledTimes(1);
    expect(setCustomUserAttribute).toHaveBeenCalledWith('plan', 'silver');
  });

  it('resends attributes after the user changes or reset', async () => {
    const plugin = new BrazePlugin();
    const traits = { email: 'a@test.com' };

    await plugin.identify({
      userId: 'a',
      traits,
    } as unknown as IdentifyEventType);
    await plugin.identify({
      userId: 'b',
      traits,
    } as unknown as IdentifyEventType);
    expect(changeUser).toHaveBeenCalledWith('b');
    expect(setEmail).toHaveBeenCalledTimes(2);

    await plugin.reset();
    await plugin.identify({
      userId: 'b',
      traits,
    } as unknown as IdentifyEventType);
    expect(setEmail).toHaveBeenCalledTimes(3);
  });

  it('persists the attribute cache across launches', async () => {
    const storage: Record<string, unknown> = {};
    const analytics = {
      getConfig: () => ({
        writeKey: 'key',
        storePersistor: {
          get: (key: string) => Promise.resolve(storage[key]),
          set: (key: string, state: unknown) => {
            storage[key] = state;
            return Promise.resolve();
          },
        },
      }),
    } as unknown as HightouchClient;
    const payload = {
      userId: 'user',
      traits: { email: 'a@test.com' },
    } as unknown as IdentifyEventType;

    const firstLaunch = new BrazePlugin();
    firstLaunch.configure(analytics);
    await firstLaunch.identify(payload);
    jest.clearAllMocks();

    const secondLaunch = new BrazePlugin();
    secondLaunch.configure(analytics);
    await secondLaunch.identify(payload);

    expect(setEmail).not.toHaveBeenCalled();
  });
});
