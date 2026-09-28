import type {
  ScreenEventType,
  TrackEventType,
} from '../../../../../core/src/types';
import type { HightouchClient } from '@ht-sdks/events-sdk-react-native';
import { BrazePlugin } from '../../BrazePlugin';
import {
  logCustomEvent,
  logPurchase,
  setAttributionData,
} from '../__mocks__/@braze/react-native-sdk';
import { UpdateType } from '../../../../../core/src/types';

describe('#track', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs a custom event', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'ACTION',
    };

    plugin.track(payload as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith('ACTION', undefined);
  });

  it('logs a custom event with properties', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'ACTION',
      properties: {
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith('ACTION', { foo: 'bar' });
  });

  it('logs tracks an install event', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Install Attributed',
    };

    plugin.track(payload as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith(
      'Install Attributed',
      undefined
    );
  });

  it('logs tracks an install event with attribution', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Install Attributed',
      properties: {
        campaign: {
          source: 'source',
          name: 'name',
          ad_group: 'ad_group',
          ad_creative: 'ad_creative',
        },
      },
    };

    plugin.track(payload as TrackEventType);

    expect(setAttributionData).toHaveBeenCalledWith(
      'source',
      'name',
      'ad_group',
      'ad_creative'
    );
    expect(logCustomEvent).toHaveBeenCalledWith('Install Attributed', {
      campaign: {
        source: 'source',
        name: 'name',
        ad_group: 'ad_group',
        ad_creative: 'ad_creative',
      },
    });
  });

  it('tracks an Application Installed event when a value is null', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Install Attributed',
      properties: {
        campaign: {
          source: 'source',
          name: 'name',
          ad_group: null,
          ad_creative: 'ad_creative',
        },
      },
    };

    plugin.track(payload as TrackEventType);

    expect(setAttributionData).toHaveBeenCalledWith(
      'source',
      'name',
      '',
      'ad_creative'
    );
    expect(logCustomEvent).toHaveBeenCalledWith('Install Attributed', {
      campaign: {
        source: 'source',
        name: 'name',
        ad_group: null,
        ad_creative: 'ad_creative',
      },
    });
  });

  it('tracks an Application Installed event when a value is undefined/missing', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Install Attributed',
      properties: {
        campaign: {
          source: 'source',
          name: 'name',
          //missing value
          // ad_group: null,
          ad_creative: 'ad_creative',
        },
      },
    };

    plugin.track(payload as TrackEventType);

    expect(setAttributionData).toHaveBeenCalledWith(
      'source',
      'name',
      '',
      'ad_creative'
    );
    expect(logCustomEvent).toHaveBeenCalledWith('Install Attributed', {
      campaign: {
        source: 'source',
        name: 'name',
        ad_creative: 'ad_creative',
      },
    });
  });

  it('logs an order completed event', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith(
      'Order Completed',
      '0',
      'USD',
      1,
      {}
    );
  });

  it('logs an order completed event in the correct currency', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
      properties: {
        currency: 'JPY',
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith('Order Completed', '0', 'JPY', 1, {
      foo: 'bar',
    });
  });

  it('logs an order completed event with revenue', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
      properties: {
        revenue: 399.99,
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith(
      'Order Completed',
      '399.99',
      'USD',
      1,
      {
        foo: 'bar',
      }
    );
  });

  it('logs an order completed event with revenue as string', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
      properties: {
        revenue: '399.99',
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith(
      'Order Completed',
      '399.99',
      'USD',
      1,
      {
        foo: 'bar',
      }
    );
  });

  it('logs an order completed event with revenue as 0', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
      properties: {
        revenue: {},
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith('Order Completed', '0', 'USD', 1, {
      foo: 'bar',
    });
  });

  it('logs an order completed event with products', () => {
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'Order Completed',
      properties: {
        revenue: '399.99',
        products: [
          {
            product_id: '123',
            price: '399.99',
            quantity: 4,
          },
        ],
        foo: 'bar',
      },
    };

    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith('123', '399.99', 'USD', 4, {
      foo: 'bar',
    });
  });

  it('logs a revenue event if `revenueEnabled` setting is true', () => {
    const settings = {
      integrations: { Appboy: { logPurchaseWhenRevenuePresent: true } },
    };
    const updateType: UpdateType = UpdateType.initial;
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'RevenueTest',
      properties: {
        revenue: 34,
        foo: 'bar',
      },
    };
    plugin.update(settings, updateType);
    plugin.track(payload as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith('RevenueTest', '34', 'USD', 1, {
      foo: 'bar',
    });
  });

  it('logs a custom event when revenue is 0', () => {
    const settings = {
      integrations: { Appboy: { logPurchaseWhenRevenuePresent: true } },
    };
    const updateType: UpdateType = UpdateType.initial;
    const plugin = new BrazePlugin();
    const payload = {
      type: 'track',
      event: 'RevenueTest',
      properties: {
        revenue: 0,
        foo: 'bar',
      },
    };
    plugin.update(settings, updateType);
    plugin.track(payload as TrackEventType);

    expect(logCustomEvent).toBeCalledWith('RevenueTest', {
      revenue: 0,
      foo: 'bar',
    });
  });

  it('prefers constructor options over settings', () => {
    const plugin = new BrazePlugin({ logPurchaseWhenRevenuePresent: false });
    plugin.update(
      { integrations: { Appboy: { logPurchaseWhenRevenuePresent: true } } },
      UpdateType.initial
    );
    plugin.track({
      event: 'RevenueTest',
      properties: { revenue: 34 },
    } as unknown as TrackEventType);

    expect(logPurchase).not.toHaveBeenCalled();
    expect(logCustomEvent).toHaveBeenCalledWith('RevenueTest', {
      revenue: 34,
    });
  });

  it('strips leading $ from event names and property keys', () => {
    const plugin = new BrazePlugin();
    plugin.track({
      event: '$ACTION',
      properties: { $foo: 'bar', nested: { a: [1] } },
    } as unknown as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith('ACTION', {
      foo: 'bar',
      nested: { a: [1] },
    });
  });

  it('stringifies property values when stringifyAttributeValues is on', () => {
    const plugin = new BrazePlugin({ stringifyAttributeValues: true });
    plugin.track({
      event: 'ACTION',
      properties: { count: 2, flag: false, nested: { a: 1 } },
    } as unknown as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith('ACTION', {
      count: '2',
      flag: 'false',
      nested: '{"a":1}',
    });
  });

  const order = {
    type: 'track',
    event: 'Order Completed',
    properties: {
      order_id: 'o1',
      revenue: 30,
      currency: 'EUR',
      store: 'nyc',
      products: [
        {
          product_id: 'p1',
          sku: 'SKU1',
          name: 'Shirt',
          brand: 'Acme',
          category: 'Apparel',
          variant: 'Red',
          position: 1,
          coupon: 'SAVE',
          price: 10,
          quantity: 2,
          size: 'M',
        },
        { product_id: 'p2', name: 'Hat', price: 10 },
      ],
    },
  } as unknown as TrackEventType;

  it('logs one purchase per product using the mobile property shape', () => {
    const plugin = new BrazePlugin();
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledTimes(2);
    expect(logPurchase).toHaveBeenCalledWith('SKU1', '10', 'EUR', 2, {
      'store': 'nyc',
      'Transaction Id': 'o1',
      'Name': 'Shirt',
      'Brand': 'Acme',
      'Category': 'Apparel',
      'Variant': 'Red',
      'Position': 1,
      'Coupon Code': 'SAVE',
      'size': 'M',
    });
    expect(logPurchase).toHaveBeenCalledWith('p2', '10', 'EUR', 1, {
      'store': 'nyc',
      'Transaction Id': 'o1',
      'Name': 'Hat',
    });
  });

  it('uses the product name when purchaseProductIdentifier is name', () => {
    const plugin = new BrazePlugin({ purchaseProductIdentifier: 'name' });
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledWith(
      'Shirt',
      '10',
      'EUR',
      2,
      expect.any(Object)
    );
    expect(logPurchase).toHaveBeenCalledWith(
      'Hat',
      '10',
      'EUR',
      1,
      expect.any(Object)
    );
  });

  it('logs a single purchase when bundleCommerceEvents is on', () => {
    const plugin = new BrazePlugin({ bundleCommerceEvents: true });
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logPurchase).toHaveBeenCalledWith(
      'eCommerce - purchase',
      '30',
      'EUR',
      1,
      {
        'store': 'nyc',
        'Transaction Id': 'o1',
        'products': [
          {
            'product_id': 'p1',
            'Id': 'SKU1',
            'name': 'Shirt',
            'brand': 'Acme',
            'category': 'Apparel',
            'variant': 'Red',
            'position': 1,
            'Coupon Code': 'SAVE',
            'price': 10,
            'quantity': 2,
            'size': 'M',
            'Total Product Amount': 20,
          },
          {
            'product_id': 'p2',
            'name': 'Hat',
            'price': 10,
            'Total Product Amount': 10,
          },
        ],
      }
    );
  });

  it('forwards screen views only when forwardScreenViews is on', () => {
    const screen = {
      type: 'screen',
      name: 'Home',
      properties: { $tab: 'feed' },
    } as unknown as ScreenEventType;

    new BrazePlugin().screen(screen);
    expect(logCustomEvent).not.toHaveBeenCalled();

    new BrazePlugin({ forwardScreenViews: true }).screen(screen);
    expect(logCustomEvent).toHaveBeenCalledWith('Home', { tab: 'feed' });
  });

  it('skips events when integrations.All is false unless Appboy is true', async () => {
    const plugin = new BrazePlugin();
    plugin.configure({
      settings: { get: () => ({ Appboy: {} }) },
      getConfig: () => ({ writeKey: 'key' }),
    } as unknown as HightouchClient);
    const event = { type: 'track', event: 'ACTION' };

    await plugin.execute({
      ...event,
      integrations: { All: false },
    } as unknown as TrackEventType);
    expect(logCustomEvent).not.toHaveBeenCalled();

    await plugin.execute({
      ...event,
      integrations: { All: false, Appboy: true },
    } as unknown as TrackEventType);
    expect(logCustomEvent).toHaveBeenCalledWith('ACTION', undefined);
  });
});
