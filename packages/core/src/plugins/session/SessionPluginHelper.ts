import type { Config, ContextSession, SessionState } from '../../types';

type TimeoutConfig = Pick<
  Config,
  'foregroundSessionTimeout' | 'backgroundSessionTimeout'
>;

export type EnrichedSessionEvent = {
  contextSession: ContextSession;
  sessionState: SessionState;
};

export const SessionPluginHelper = {
  isEnabled(config: TimeoutConfig): boolean {
    return !(
      config.foregroundSessionTimeout === 0 &&
      config.backgroundSessionTimeout === 0
    );
  },

  shouldRotateOnResume(
    state: SessionState | undefined,
    now: number,
    backgroundSessionTimeout = 0
  ): boolean {
    if (
      state?.backgroundedAt === undefined ||
      state.backgroundedAt === null ||
      backgroundSessionTimeout <= 0
    ) {
      return false;
    }

    return now - state.backgroundedAt > backgroundSessionTimeout;
  },

  shouldRotateOnInactivity(
    state: SessionState | undefined,
    now: number,
    foregroundSessionTimeout = 0
  ): boolean {
    if (state === undefined || foregroundSessionTimeout <= 0) {
      return false;
    }

    return now - state.lastActivityAt > foregroundSessionTimeout;
  },

  rotateSession(
    state: SessionState | undefined,
    now: number,
    firstEventId: string,
    firstEventTimestamp: string
  ): SessionState {
    return {
      sessionId: now,
      sessionIndex: state === undefined ? 0 : state.sessionIndex + 1,
      previousSessionId: state?.sessionId ?? null,
      firstEventId,
      firstEventTimestamp,
      eventIndex: 0,
      lastActivityAt: now,
      backgroundedAt: null,
    };
  },

  enrichEvent(
    state: SessionState,
    now: number,
    options: { updateActivity?: boolean } = {}
  ): EnrichedSessionEvent {
    const sessionStart = state.eventIndex === 0;
    const updateActivity = options.updateActivity ?? true;
    const contextSession: ContextSession = {
      sessionId: state.sessionId,
      sessionIndex: state.sessionIndex,
      eventIndex: state.eventIndex,
      previousSessionId: state.previousSessionId,
      firstEventId: state.firstEventId,
      firstEventTimestamp: state.firstEventTimestamp,
      ...(sessionStart ? { sessionStart: true } : {}),
    };

    return {
      contextSession,
      sessionState: {
        ...state,
        eventIndex: state.eventIndex + 1,
        lastActivityAt: updateActivity ? now : state.lastActivityAt,
        backgroundedAt: updateActivity ? null : state.backgroundedAt,
      },
    };
  },

  ensureFirstEvent(
    state: SessionState,
    messageId: string,
    timestamp: string
  ): SessionState {
    if (state.eventIndex !== 0 || state.firstEventId !== '') {
      return state;
    }

    return {
      ...state,
      firstEventId: messageId,
      firstEventTimestamp: timestamp,
    };
  },

  processEvent({
    state,
    now,
    messageId,
    timestamp,
    foregroundSessionTimeout = 0,
    backgroundSessionTimeout = 0,
    isAppInBackground = false,
  }: {
    state: SessionState | undefined;
    now: number;
    messageId: string;
    timestamp: string;
    foregroundSessionTimeout?: number;
    backgroundSessionTimeout?: number;
    isAppInBackground?: boolean;
  }): EnrichedSessionEvent {
    const shouldRotate =
      state === undefined ||
      (!isAppInBackground &&
        (SessionPluginHelper.shouldRotateOnResume(
          state,
          now,
          backgroundSessionTimeout
        ) ||
          SessionPluginHelper.shouldRotateOnInactivity(
            state,
            now,
            foregroundSessionTimeout
          )));

    const currentState = shouldRotate
      ? SessionPluginHelper.rotateSession(state, now, messageId, timestamp)
      : SessionPluginHelper.ensureFirstEvent(state, messageId, timestamp);

    return SessionPluginHelper.enrichEvent(currentState, now, {
      updateActivity: !isAppInBackground,
    });
  },

  markBackgrounded(
    state: SessionState | undefined,
    now: number
  ): SessionState | undefined {
    if (state === undefined) {
      return state;
    }

    return {
      ...state,
      backgroundedAt: now,
    };
  },

  markForegrounded({
    state,
    now,
    backgroundSessionTimeout = 0,
  }: {
    state: SessionState | undefined;
    now: number;
    backgroundSessionTimeout?: number;
  }): SessionState | undefined {
    if (state === undefined) {
      return state;
    }

    if (
      SessionPluginHelper.shouldRotateOnResume(
        state,
        now,
        backgroundSessionTimeout
      )
    ) {
      return state;
    }

    return {
      ...state,
      lastActivityAt: now,
      backgroundedAt: null,
    };
  },
} as const;
