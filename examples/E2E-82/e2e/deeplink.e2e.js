const { element, by, device } = require('detox');

import { startServer, stopServer } from './mockServer';
import { setupMatchers } from './matchers';

describe('#deepLinkTest', () => {
  const mockServerListener = jest.fn();
  const flushButton = element(by.id('BUTTON_FLUSH'));
  const deepLinkUrl = 'hightouchreactnative://hello?utm_source=e2e';

  beforeAll(async () => {
    await startServer(mockServerListener);
    setupMatchers();
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(async () => {
    mockServerListener.mockReset();
    await device.launchApp({ newInstance: true });
  });

  it('handles a deep link while the app is backgrounded without crashing', async () => {
    await expect(flushButton).toBeVisible();

    await device.sendToHome();
    await device.launchApp({ newInstance: false, url: deepLinkUrl });

    await expect(flushButton).toBeVisible();

    await flushButton.tap();

    expect(mockServerListener).toHaveBeenCalled();

    const events = mockServerListener.mock.calls[0][0].batch;
    const deepLinkEvent = events.find(
      (item) => item.type === 'track' && item.event === 'Deep Link Opened',
    );

    expect(deepLinkEvent).toBeDefined();
    expect(deepLinkEvent.properties.url).toBe(deepLinkUrl);
    expect(deepLinkEvent.properties.utm_source).toBe('e2e');
  });
});
