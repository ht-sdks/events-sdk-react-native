import {
  AppState,
  AppStateStatus,
  NativeEventSubscription,
} from 'react-native';
import type { HightouchClient } from '../../analytics';
import { EventPlugin } from '../../plugin';
import { SessionPluginHelper } from './SessionPluginHelper';
import type { ContextSession, HightouchEvent } from '../../types';
import { PluginType } from '../../types';

const INACTIVE_STATES: ReadonlyArray<AppStateStatus> = [
  'inactive',
  'background',
];

export class SessionPlugin extends EventPlugin {
  type = PluginType.enrichment;
  private appStateSubscription?: NativeEventSubscription;
  private appState: AppStateStatus = AppState.currentState;
  private foregroundSessionTimeout = 0;
  private backgroundSessionTimeout = 0;
  private enabled = false;

  configure(analytics: HightouchClient): void {
    super.configure(analytics);

    const config = analytics.getConfig();
    this.foregroundSessionTimeout = config.foregroundSessionTimeout ?? 0;
    this.backgroundSessionTimeout = config.backgroundSessionTimeout ?? 0;
    this.enabled = SessionPluginHelper.isEnabled(config);

    if (this.enabled) {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );
    }
  }

  async execute(event: HightouchEvent): Promise<HightouchEvent> {
    if (!this.enabled || this.analytics === undefined) {
      return event;
    }

    const now = Date.now();
    let contextSession: ContextSession | undefined;

    await this.analytics.sessionState.set((state) => {
      const result = SessionPluginHelper.processEvent({
        state,
        now,
        messageId: event.messageId ?? '',
        timestamp: event.timestamp ?? new Date(now).toISOString(),
        foregroundSessionTimeout: this.foregroundSessionTimeout,
        backgroundSessionTimeout: this.backgroundSessionTimeout,
        isAppInBackground: INACTIVE_STATES.includes(this.appState),
      });
      contextSession = result.contextSession;
      return result.sessionState;
    });

    if (contextSession === undefined) {
      return event;
    }

    event.context = this.addSessionContext(event, contextSession);
    return event;
  }

  async reset(): Promise<void> {
    if (!this.enabled || this.analytics === undefined) {
      return;
    }

    const now = Date.now();
    await this.analytics.sessionState.set((state) =>
      SessionPluginHelper.rotateSession(
        state,
        now,
        '',
        new Date(now).toISOString()
      )
    );
  }

  shutdown(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = undefined;
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (!this.enabled || this.analytics === undefined) {
      this.appState = nextAppState;
      return;
    }

    const previousAppState = this.appState;
    this.appState = nextAppState;
    const now = Date.now();

    if (
      previousAppState === 'active' &&
      INACTIVE_STATES.includes(nextAppState)
    ) {
      void this.analytics.sessionState.set((state) =>
        SessionPluginHelper.markBackgrounded(state, now)
      );
    } else if (
      INACTIVE_STATES.includes(previousAppState) &&
      nextAppState === 'active'
    ) {
      void this.analytics.sessionState.set((state) =>
        SessionPluginHelper.markForegrounded({
          state,
          now,
          backgroundSessionTimeout: this.backgroundSessionTimeout,
        })
      );
    }
  };

  private addSessionContext(
    event: HightouchEvent,
    contextSession: ContextSession
  ): HightouchEvent['context'] {
    const context = { ...(event.context ?? {}) };
    delete context.sessionStart;

    return {
      ...context,
      session: contextSession,
      sessionId: contextSession.sessionId,
      ...(contextSession.sessionStart === true ? { sessionStart: true } : {}),
    };
  }
}
