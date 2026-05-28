import type { Config } from './types';

export const defaultApiHost = 'https://us-east-1.hightouch-events.com/v1/b';

export const defaultConfig: Config = {
  writeKey: '',
  maxBatchSize: 1000,
  trackDeepLinks: false,
  trackAppLifecycleEvents: false,
};

export const workspaceDestinationFilterKey = '';

export const defaultFlushAt = 20;
export const defaultFlushInterval = 30;

export const STORAGE_READY_TIMEOUT_MS = 5_000;

// The events API rejects events older than 7 days, so a persisted pending
// event past that point can never be delivered and should be dropped on replay.
export const MAX_PENDING_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
