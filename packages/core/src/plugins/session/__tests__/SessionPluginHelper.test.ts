import { SessionPluginHelper } from '../SessionPluginHelper';
import type { SessionState } from '../../../types';

const initialState: SessionState = {
  sessionId: 1000,
  sessionIndex: 0,
  previousSessionId: null,
  firstEventId: 'first-message-id',
  firstEventTimestamp: '2026-01-01T00:00:01.000Z',
  eventIndex: 1,
  lastActivityAt: 1000,
  backgroundedAt: null,
};

describe('SessionPluginHelper', () => {
  it('creates the first session on the first event', () => {
    const result = SessionPluginHelper.processEvent({
      state: undefined,
      now: 1000,
      messageId: 'message-id',
      timestamp: '2026-01-01T00:00:01.000Z',
      foregroundSessionTimeout: 1800000,
      backgroundSessionTimeout: 1800000,
    });

    expect(result.contextSession).toEqual({
      sessionId: 1000,
      sessionIndex: 0,
      sessionStart: true,
      eventIndex: 0,
      previousSessionId: null,
      firstEventId: 'message-id',
      firstEventTimestamp: '2026-01-01T00:00:01.000Z',
    });
    expect(result.sessionState).toEqual({
      sessionId: 1000,
      sessionIndex: 0,
      previousSessionId: null,
      firstEventId: 'message-id',
      firstEventTimestamp: '2026-01-01T00:00:01.000Z',
      eventIndex: 1,
      lastActivityAt: 1000,
      backgroundedAt: null,
    });
  });

  it('increments the event index within the same session', () => {
    const result = SessionPluginHelper.processEvent({
      state: initialState,
      now: 2000,
      messageId: 'second-message-id',
      timestamp: '2026-01-01T00:00:02.000Z',
      foregroundSessionTimeout: 1800000,
      backgroundSessionTimeout: 1800000,
    });

    expect(result.contextSession).toEqual({
      sessionId: 1000,
      sessionIndex: 0,
      eventIndex: 1,
      previousSessionId: null,
      firstEventId: 'first-message-id',
      firstEventTimestamp: '2026-01-01T00:00:01.000Z',
    });
    expect(result.sessionState.eventIndex).toBe(2);
    expect(result.sessionState.lastActivityAt).toBe(2000);
  });

  it('rotates after foreground inactivity exceeds the configured timeout', () => {
    const result = SessionPluginHelper.processEvent({
      state: initialState,
      now: 3000,
      messageId: 'new-session-message-id',
      timestamp: '2026-01-01T00:00:03.000Z',
      foregroundSessionTimeout: 1999,
      backgroundSessionTimeout: 1800000,
    });

    expect(result.contextSession).toEqual({
      sessionId: 3000,
      sessionIndex: 1,
      sessionStart: true,
      eventIndex: 0,
      previousSessionId: 1000,
      firstEventId: 'new-session-message-id',
      firstEventTimestamp: '2026-01-01T00:00:03.000Z',
    });
  });

  it('rotates on the first event after a long background duration', () => {
    const backgroundedState = {
      ...initialState,
      backgroundedAt: 1500,
    };

    const foregroundedState = SessionPluginHelper.markForegrounded({
      state: backgroundedState,
      now: 4000,
      backgroundSessionTimeout: 2000,
    });

    const result = SessionPluginHelper.processEvent({
      state: foregroundedState,
      now: 4000,
      messageId: 'foreground-message-id',
      timestamp: '2026-01-01T00:00:04.000Z',
      foregroundSessionTimeout: 1800000,
      backgroundSessionTimeout: 2000,
    });

    expect(result.contextSession).toEqual({
      sessionId: 4000,
      sessionIndex: 1,
      sessionStart: true,
      eventIndex: 0,
      previousSessionId: 1000,
      firstEventId: 'foreground-message-id',
      firstEventTimestamp: '2026-01-01T00:00:04.000Z',
    });
  });

  it('rotates on cold start when persisted background duration exceeded timeout', () => {
    const result = SessionPluginHelper.processEvent({
      state: {
        ...initialState,
        backgroundedAt: 1500,
      },
      now: 4000,
      messageId: 'cold-start-message-id',
      timestamp: '2026-01-01T00:00:04.000Z',
      foregroundSessionTimeout: 1800000,
      backgroundSessionTimeout: 2000,
    });

    expect(result.contextSession.sessionId).toBe(4000);
    expect(result.contextSession.sessionIndex).toBe(1);
    expect(result.contextSession.previousSessionId).toBe(1000);
    expect(result.contextSession.firstEventId).toBe('cold-start-message-id');
  });

  it('rotates when reset starts a new session', () => {
    const rotatedState = SessionPluginHelper.rotateSession(
      initialState,
      5000,
      'reset-message-id',
      '2026-01-01T00:00:05.000Z'
    );

    expect(rotatedState).toEqual({
      sessionId: 5000,
      sessionIndex: 1,
      previousSessionId: 1000,
      firstEventId: 'reset-message-id',
      firstEventTimestamp: '2026-01-01T00:00:05.000Z',
      eventIndex: 0,
      lastActivityAt: 5000,
      backgroundedAt: null,
    });
  });

  it('is disabled only when both timeouts are zero', () => {
    expect(
      SessionPluginHelper.isEnabled({
        foregroundSessionTimeout: 0,
        backgroundSessionTimeout: 0,
      })
    ).toBe(false);
    expect(
      SessionPluginHelper.isEnabled({
        foregroundSessionTimeout: 1,
        backgroundSessionTimeout: 0,
      })
    ).toBe(true);
  });
});
