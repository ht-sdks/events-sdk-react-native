import type { HightouchEvent } from '../types';
import { createMockStoreGetter } from './mockHightouchStore';
import { createCallbackManager } from './utils';

export class MockEventStore {
  private initialData: HightouchEvent[] = [];
  private events: HightouchEvent[] = [];

  private callbackManager = createCallbackManager<{ events: HightouchEvent[] }>();

  constructor(initialData?: HightouchEvent[]) {
    this.events = [...(initialData ?? [])];
    this.initialData = JSON.parse(
      JSON.stringify(initialData ?? [])
    ) as HightouchEvent[];
  }

  reset = () => {
    this.events = JSON.parse(
      JSON.stringify(this.initialData)
    ) as HightouchEvent[];
  };

  getState = createMockStoreGetter(() => ({ events: this.events }));

  subscribe = (callback: (value: { events: HightouchEvent[] }) => void) =>
    this.callbackManager.register(callback);

  dispatch = (
    callback: (value: { events: HightouchEvent[] }) => { events: HightouchEvent[] }
  ) => {
    this.events = callback({ events: this.events }).events;
    this.callbackManager.run({ events: this.events });
  };
}
