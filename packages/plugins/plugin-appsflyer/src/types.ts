export type HightouchAppsflyerSettings = {
  appleAppID?: string;
  appsFlyerDevKey: string;
  httpFallback: boolean;
  rokuAppID?: string;
  trackAttributionData: boolean;
  type: string;
  versionSettings: { [key: string]: string[] };
};
