import { HightouchClient } from '../../analytics';
import { getMockLogger, MockHightouchStore } from '../../test-helpers';

jest.mock('uuid');

jest
  .spyOn(Date.prototype, 'toISOString')
  .mockReturnValue('2010-01-01T00:00:00.000Z');

describe('methods #group', () => {
  const store = new MockHightouchStore({
    userInfo: {
      userId: 'current-user-id',
      anonymousId: 'very-anonymous',
    },
  });

  const clientArgs = {
    config: {
      writeKey: 'mock-write-key',
      flushInterval: 0,
    },
    logger: getMockLogger(),
    store: store,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds the alias event correctly', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client, 'process');

    await client.group('new-group-id', { name: 'Best Group Ever' });

    const expectedEvent = {
      groupId: 'new-group-id',
      type: 'group',
      traits: {
        name: 'Best Group Ever',
      },
    };

    expect(client.process).toHaveBeenCalledTimes(1);
    expect(client.process).toHaveBeenCalledWith(expectedEvent);
    expect(
      (client.process as jest.Mock).mock.calls[0][0].context
    ).toBeUndefined();
  });

  it('stamps per-call context onto the group event', async () => {
    const client = new HightouchClient(clientArgs);
    jest.spyOn(client, 'process');

    await client.group(
      'new-group-id',
      { name: 'Best Group Ever' },
      { protocols: { schemaVersion: 'v1' } }
    );

    expect(client.process).toHaveBeenCalledWith({
      groupId: 'new-group-id',
      type: 'group',
      traits: {
        name: 'Best Group Ever',
      },
      context: {
        protocols: {
          schemaVersion: 'v1',
        },
      },
    });
  });
});
