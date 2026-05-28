import { AppState, AppStateStatus } from 'react-native';
import { BackgroundFlushPolicy } from '../background-flush-policy';

function setupPolicy(initialAppState: AppStateStatus = 'active') {
  AppState.currentState = initialAppState;
  let updateCallback = (_val: AppStateStatus) => {
    return;
  };
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_action, callback) => {
      updateCallback = callback;
      return { remove: jest.fn() };
    });

  const policy = new BackgroundFlushPolicy();
  policy.start();
  const observer = jest.fn();
  policy.shouldFlush.onChange(observer);

  return {
    addSpy,
    policy,
    observer,
    transitionTo: (state: AppStateStatus) => updateCallback(state),
  };
}

describe('BackgroundFlushPolicy', () => {
  it('flushes when an active app transitions to background', () => {
    const { addSpy, observer, transitionTo } = setupPolicy('active');

    expect(addSpy).toHaveBeenCalledTimes(1);

    transitionTo('background');
    expect(observer).toHaveBeenCalledWith(true);
  });

  it('flushes when an active app transitions to inactive', () => {
    const { observer, transitionTo } = setupPolicy('active');

    transitionTo('inactive');
    expect(observer).toHaveBeenCalledWith(true);
  });

  it('does not flush when transitioning back to active', () => {
    const { observer, transitionTo } = setupPolicy('active');

    transitionTo('background');
    observer.mockClear();

    transitionTo('active');
    expect(observer).not.toHaveBeenCalled();
  });

  it('flushes after the next active→background even when constructed before AppState settled', () => {
    const { observer, transitionTo } = setupPolicy('unknown' as AppStateStatus);

    transitionTo('active');
    expect(observer).not.toHaveBeenCalled();

    transitionTo('background');
    expect(observer).toHaveBeenCalledWith(true);
  });

  it('does not double-fire on active→inactive→background', () => {
    const { observer, transitionTo } = setupPolicy('active');

    transitionTo('inactive');
    transitionTo('background');

    expect(observer.mock.calls).toEqual([[true]]);
  });
});
