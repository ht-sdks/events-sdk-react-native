import group from '../group';
import type { GroupEventType } from '@ht-sdks/events-sdk-react-native';
import type { HightouchMixpanelSettings } from '../../types';
import { sampleIntegrationSettings } from './__helpers__/constants';
import { Mixpanel } from '../__mocks__/mixpanel-react-native';

describe('#group', () => {
  let mixpanel: Mixpanel;
  const payload = {
    type: 'group',
    traits: {
      company_id: 'the_red_f',
      coolGroup: false,
      members: 4,
    },
    groupId: '23322',
  } as GroupEventType;
  const settings: HightouchMixpanelSettings =
    sampleIntegrationSettings.integrations.Mixpanel;

  beforeEach(() => {
    jest.clearAllMocks();
    mixpanel = new Mixpanel('1234');
  });

  it('calls the group method when id is present', () => {
    const getGroupSpy = jest.spyOn(mixpanel, 'getGroup');
    settings.groupIdentifierTraits = ['company_id'];
    const groupId = payload.groupId;
    const setGroupTrait = 'company_id';
    const mockedId = '23322';
    const mockedGroupTrait = 'the_red_f';

    group(payload, mixpanel, settings);

    expect(mixpanel.setGroup).toBeCalledWith(setGroupTrait, groupId);
    expect(getGroupSpy).toBeCalledWith(mockedGroupTrait, mockedId);
  });

  it(' does not call the group method when no traits are provided in settings', () => {
    const getGroupSpy = jest.spyOn(mixpanel, 'getGroup');
    settings.groupIdentifierTraits = [];

    group(payload, mixpanel, settings);

    expect(mixpanel.setGroup).toBeCalledTimes(0);
    expect(getGroupSpy).not.toBeCalled();
  });
});
