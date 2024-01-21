import type { HightouchEvent } from '../types';
import { FlushPolicyBase } from './types';

/**
 * StatupFlushPolicy triggers a flush right away on client startup
 */
export class StartupFlushPolicy extends FlushPolicyBase {
  start() {
    this.shouldFlush.value = true;
  }

  onEvent(_event: HightouchEvent): void {
    // Nothing to do
  }
}
