import {
  AppState,
  AppStateStatus,
  NativeEventSubscription,
} from 'react-native';
import type { HightouchEvent } from '../types';
import { FlushPolicyBase } from './types';

const INACTIVE_STATES: ReadonlyArray<AppStateStatus> = [
  'inactive',
  'background',
];

/**
 * BackgroundFlushPolicy triggers a flush whenever the app moves from a foreground state to a background state.
 */
export class BackgroundFlushPolicy extends FlushPolicyBase {
  private appStateSubscription?: NativeEventSubscription;
  private lastState: AppStateStatus = AppState.currentState;

  start() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  onEvent(_event: HightouchEvent): void {
    // Nothing to do — this policy is driven by AppState transitions, not events.
  }

  end(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = undefined;
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    const previousState = this.lastState;
    this.lastState = nextState;

    if (
      !INACTIVE_STATES.includes(previousState) &&
      INACTIVE_STATES.includes(nextState)
    ) {
      this.shouldFlush.value = true;
    }
  };
}
