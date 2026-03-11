import { DestinationPlugin } from '../plugin';
import {
  PluginType,
  HightouchAPIIntegration,
  HightouchAPISettings,
  HightouchEvent,
  UpdateType,
} from '../types';
import { chunk } from '../util';
import { uploadEvents } from '../api';
import type { HightouchClient } from '../analytics';
import { QueueFlushingPlugin } from './QueueFlushingPlugin';
import { defaultApiHost } from '../constants';
import {
  checkResponseForErrors,
  isRequestScopedError,
  isRetryableError,
  translateHTTPError,
} from '../errors';
import { defaultConfig } from '../constants';

const MAX_EVENTS_PER_BATCH = 100;
const MAX_PAYLOAD_SIZE_IN_KB = 500;
export const HIGHTOUCH_DESTINATION_KEY = 'Hightouch.io';

interface UploadBatchResult {
  sent: HightouchEvent[];
  dropped: HightouchEvent[];
  failed: number;
}

export class HightouchDestination extends DestinationPlugin {
  type = PluginType.destination;
  key = HIGHTOUCH_DESTINATION_KEY;
  private apiHost?: string;
  private isReady = false;

  /**
   * Uploads a batch of events. Request-scoped errors (401/403/404) drop the
   * entire batch immediately. Event-scoped errors (400) trigger a recursive
   * bisect to isolate the bad event(s). Retryable errors (5xx/429) leave
   * events in the queue for the next flush cycle.
   */
  private uploadBatch = async (
    batch: HightouchEvent[],
    writeKey: string,
    url: string
  ): Promise<UploadBatchResult> => {
    if (batch.length === 0) {
      return { sent: [], dropped: [], failed: 0 };
    }

    try {
      const res = await uploadEvents({ writeKey, url, events: batch });
      checkResponseForErrors(res);
      return { sent: batch, dropped: [], failed: 0 };
    } catch (e) {
      this.analytics?.reportInternalError(translateHTTPError(e));

      if (isRetryableError(e)) {
        return { sent: [], dropped: [], failed: batch.length };
      }

      // Request-scoped errors (401/403/404) affect all events equally —
      // splitting cannot help, so drop the entire batch immediately.
      if (isRequestScopedError(e)) {
        const status =
          e instanceof Error ? e.message : 'unknown';
        this.analytics?.logger.error(
          `Dropped ${batch.length} event(s) due to request-scoped error: ${status}`
        );
        return { sent: [], dropped: batch, failed: batch.length };
      }

      if (batch.length === 1) {
        this.analytics?.logger.error(
          `Dropped non-retryable event: ${batch[0]?.messageId}`
        );
        return { sent: [], dropped: batch, failed: 1 };
      }

      // Split in half to isolate the bad event(s) — only for 400 (validation)
      const mid = Math.ceil(batch.length / 2);
      const [left, right] = await Promise.all([
        this.uploadBatch(batch.slice(0, mid), writeKey, url),
        this.uploadBatch(batch.slice(mid), writeKey, url),
      ]);

      return {
        sent: [...left.sent, ...right.sent],
        dropped: [...left.dropped, ...right.dropped],
        failed: left.failed + right.failed,
      };
    }
  };

  private sendEvents = async (events: HightouchEvent[]): Promise<void> => {
    if (!this.isReady) {
      return Promise.resolve();
    }

    if (events.length === 0) {
      return Promise.resolve();
    }

    const config = this.analytics?.getConfig() ?? defaultConfig;
    const writeKey = config.writeKey;
    const url = this.getEndpoint();

    const chunkedEvents: HightouchEvent[][] = chunk(
      events,
      config.maxBatchSize ?? MAX_EVENTS_PER_BATCH,
      MAX_PAYLOAD_SIZE_IN_KB
    );

    let dequeuedEvents: HightouchEvent[] = [];
    let numSent = 0;
    let numDropped = 0;
    let numFailed = 0;

    await Promise.all(
      chunkedEvents.map(async (batch: HightouchEvent[]) => {
        const result = await this.uploadBatch(batch, writeKey, url);
        numSent += result.sent.length;
        numDropped += result.dropped.length;
        numFailed += result.failed;
        dequeuedEvents = dequeuedEvents.concat(result.sent, result.dropped);
        await this.queuePlugin.dequeue(dequeuedEvents);
      })
    );

    if (config.debug === true && numSent > 0) {
      this.analytics?.logger.info(`Sent ${numSent} events`);
    }

    if (numDropped > 0) {
      this.analytics?.logger.error(
        `Dropped ${numDropped} non-retryable events.`
      );
    }

    if (numFailed > numDropped) {
      this.analytics?.logger.error(
        `Failed to send ${numFailed - numDropped} events.`
      );
    }
  };

  private readonly queuePlugin = new QueueFlushingPlugin(this.sendEvents);

  private getEndpoint(): string {
    const config = this.analytics?.getConfig();
    return config?.proxy ?? this.apiHost ?? defaultApiHost;
  }

  configure(analytics: HightouchClient): void {
    super.configure(analytics);

    // This does not apply to Hightouch.
    // Enrich events with the Destination metadata
    // this.add(new DestinationMetadataEnrichment(HIGHTOUCH_DESTINATION_KEY));

    this.add(this.queuePlugin);
  }

  // We block sending stuff to Hightouch until we get the settings
  update(settings: HightouchAPISettings, _type: UpdateType): void {
    const hightouchSettings = settings.integrations[
      this.key
    ] as HightouchAPIIntegration;
    if (
      hightouchSettings?.apiHost !== undefined &&
      hightouchSettings?.apiHost !== null
    ) {
      this.apiHost = `https://${hightouchSettings.apiHost}/b`;
    }
    this.isReady = true;
  }

  execute(event: HightouchEvent): Promise<HightouchEvent | undefined> {
    // Execute the internal timeline here, the queue plugin will pick up the event and add it to the queue automatically
    const enrichedEvent = super.execute(event);
    return enrichedEvent;
  }

  async flush() {
    return this.queuePlugin.flush();
  }
}
