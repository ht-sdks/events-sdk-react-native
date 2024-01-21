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
