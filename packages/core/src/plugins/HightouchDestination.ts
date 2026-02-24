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
import { checkResponseForErrors, translateHTTPError } from '../errors';
import { defaultConfig } from '../constants';

const MAX_EVENTS_PER_BATCH = 100;
const MAX_PAYLOAD_SIZE_IN_KB = 500;
export const HIGHTOUCH_DESTINATION_KEY = 'Hightouch.io';

export class HightouchDestination extends DestinationPlugin {
  type = PluginType.destination;
  key = HIGHTOUCH_DESTINATION_KEY;
  private apiHost?: string;
  private isReady = false;

  private sendEvents = async (events: HightouchEvent[]): Promise<void> => {
    if (!this.isReady) {
      return Promise.resolve();
    }

    if (events.length === 0) {
      return Promise.resolve();
    }

    const config = this.analytics?.getConfig() ?? defaultConfig;

    const chunkedEvents: HightouchEvent[][] = chunk(
      events,
      config.maxBatchSize ?? MAX_EVENTS_PER_BATCH,
      MAX_PAYLOAD_SIZE_IN_KB
    );

    const results = await Promise.allSettled(
      chunkedEvents.map(async (batch: HightouchEvent[]) => {
        const res = await uploadEvents({
          writeKey: config.writeKey,
          url: this.getEndpoint(),
          events: batch,
        });
        checkResponseForErrors(res);
        return batch;
      })
    );

    const sentEvents: HightouchEvent[] = [];
    let numFailedEvents = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sentEvents.push(...result.value);
      } else {
        this.analytics?.reportInternalError(translateHTTPError(result.reason));
        this.analytics?.logger.warn(result.reason);
        const failedBatchIndex = results.indexOf(result);
        numFailedEvents += chunkedEvents[failedBatchIndex]?.length ?? 0;
      }
    }

    if (sentEvents.length > 0) {
      await this.queuePlugin.dequeue(sentEvents);
      if (config.debug === true) {
        this.analytics?.logger.info(`Sent ${sentEvents.length} events`);
      }
    }

    if (numFailedEvents > 0) {
      this.analytics?.logger.error(`Failed to send ${numFailedEvents} events.`);
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
