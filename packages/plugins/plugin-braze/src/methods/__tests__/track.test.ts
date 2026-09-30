import type {
  ScreenEventType,
  TrackEventType,
} from '../../../../../core/src/types';
import type { HightouchClient } from '@ht-sdks/events-sdk-react-native';
import {
  BrazePlugin,
  BrazePluginOptions,
  BrazePurchase,
  BrazePurchaseContext,
} from '../../BrazePlugin';
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
      currency: 'JPY',
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
        revenue: 399.99,
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
        revenue: '399.99',
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
      revenue: {},
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
      revenue: '399.99',
      foo: 'bar',
      product_id: '123',
    });
  });

  const withWarn = (plugin: BrazePlugin) => {
    const warn = jest.fn();
    plugin.configure({
      settings: { get: () => ({ Appboy: {} }) },
      getConfig: () => ({ writeKey: 'key' }),
      logger: { warn },
    } as unknown as HightouchClient);
    return warn;
  };

  const purchase = (event: string) =>
    ({ event, properties: { revenue: 5 } } as unknown as TrackEventType);

  it('treats Order Completed and Completed Order as purchases by default', () => {
    const plugin = new BrazePlugin();
    plugin.track(purchase('Order Completed'));
    plugin.track(purchase('Completed Order'));
    plugin.track(purchase('order completed'));

    expect(logPurchase).toHaveBeenCalledTimes(2);
    expect(logCustomEvent).toHaveBeenCalledTimes(1);
    expect(logCustomEvent).toHaveBeenCalledWith('order completed', {
      revenue: 5,
    });
  });

  it('uses purchaseEventNames from constructor options', () => {
    const plugin = new BrazePlugin({
      purchaseEventNames: ['Membership Purchased'],
    });
    plugin.update(
      { integrations: { Appboy: { purchaseEventNames: ['Other'] } } },
      UpdateType.initial
    );
    plugin.track(purchase('Membership Purchased'));
    plugin.track(purchase('Other'));
    plugin.track(purchase('Order Completed'));

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logPurchase).toHaveBeenCalledWith(
      'Membership Purchased',
      '5',
      'USD',
      1,
      { revenue: 5 }
    );
    expect(logCustomEvent).toHaveBeenCalledTimes(2);
  });

  it('uses purchaseEventNames from settings', () => {
    const plugin = new BrazePlugin();
    plugin.update(
      {
        integrations: {
          Appboy: { purchaseEventNames: ['Membership Purchased'] },
        },
      },
      UpdateType.initial
    );
    plugin.track(purchase('Membership Purchased'));
    plugin.track(purchase('Order Completed'));

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logCustomEvent).toHaveBeenCalledWith('Order Completed', {
      revenue: 5,
    });
  });

  it('lets isPurchaseEvent override purchaseEventNames', () => {
    const plugin = new BrazePlugin({
      isPurchaseEvent: (event) => event.properties?.paid === true,
    });
    plugin.update(
      {
        integrations: {
          Appboy: { purchaseEventNames: ['Membership Purchased'] },
        },
      },
      UpdateType.initial
    );
    plugin.track({
      event: 'Checkout',
      properties: { paid: true },
    } as unknown as TrackEventType);
    plugin.track(purchase('Membership Purchased'));
    plugin.track(purchase('Order Completed'));

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logPurchase).toHaveBeenCalledWith('Checkout', '0', 'USD', 1, {
      paid: true,
    });
    expect(logCustomEvent).toHaveBeenCalledTimes(2);
    expect(logCustomEvent).toHaveBeenCalledWith('Order Completed', {
      revenue: 5,
    });
  });

  it('logs a custom event and warns when isPurchaseEvent throws', () => {
    const error = new Error('boom');
    const plugin = new BrazePlugin({
      isPurchaseEvent: () => {
        throw error;
      },
    });
    const warn = withWarn(plugin);
    plugin.track(purchase('Order Completed'));

    expect(logPurchase).not.toHaveBeenCalled();
    expect(logCustomEvent).toHaveBeenCalledWith('Order Completed', {
      revenue: 5,
    });
    expect(warn).toHaveBeenCalledWith(expect.any(String), error);
  });

  it('passes event names and property keys through unchanged', () => {
    const plugin = new BrazePlugin();
    plugin.track({
      event: '$ACTION',
      properties: { $foo: 'bar', nested: { a: [1] } },
    } as unknown as TrackEventType);

    expect(logCustomEvent).toHaveBeenCalledWith('$ACTION', {
      $foo: 'bar',
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
      coupon: 'ORDER',
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

  const orderProperties = {
    order_id: 'o1',
    revenue: 30,
    currency: 'EUR',
    store: 'nyc',
  };

  it('logs one purchase per product with order and product fields', () => {
    const plugin = new BrazePlugin();
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledTimes(2);
    expect(logPurchase).toHaveBeenCalledWith('SKU1', '10', 'EUR', 2, {
      ...orderProperties,
      product_id: 'p1',
      sku: 'SKU1',
      name: 'Shirt',
      brand: 'Acme',
      category: 'Apparel',
      variant: 'Red',
      position: 1,
      coupon: 'SAVE',
      size: 'M',
    });
    expect(logPurchase).toHaveBeenCalledWith('p2', '10', 'EUR', 1, {
      ...orderProperties,
      coupon: 'ORDER',
      product_id: 'p2',
      name: 'Hat',
    });
  });

  it('falls back to the product name and skips products without an ID', () => {
    const plugin = new BrazePlugin();
    const warn = withWarn(plugin);
    plugin.track({
      event: 'Order Completed',
      properties: { products: [{ name: 'Hat' }, { price: 5 }] },
    } as unknown as TrackEventType);

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logPurchase).toHaveBeenCalledWith('Hat', '0', 'USD', 1, {
      name: 'Hat',
    });
    expect(warn).toHaveBeenCalledTimes(1);
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
      'Order Completed',
      '30',
      'EUR',
      1,
      order.properties
    );
  });

  it('lets transformPurchase change purchases', () => {
    const transformPurchase = jest.fn(
      (p: BrazePurchase, { order: o, product }: BrazePurchaseContext) => ({
        ...p,
        productId: String(product?.name),
        properties: { 'Transaction Id': o.order_id },
      })
    );
    const plugin = new BrazePlugin({ transformPurchase });
    plugin.track(order);

    expect(transformPurchase.mock.calls[0]).toMatchObject([
      { productId: 'SKU1' },
      { event: order, order: order.properties, product: { sku: 'SKU1' } },
    ]);
    expect(logPurchase).toHaveBeenCalledWith('Shirt', '10', 'EUR', 2, {
      'Transaction Id': 'o1',
    });
    expect(logPurchase).toHaveBeenCalledWith('Hat', '10', 'EUR', 1, {
      'Transaction Id': 'o1',
    });
  });

  it('applies the mParticle mobile purchase recipe', () => {
    const orderNames: Record<string, string> = {
      order_id: 'Transaction Id',
      revenue: 'Total Amount',
      tax: 'Tax Amount',
      shipping: 'Shipping Amount',
    };
    const productNames: Record<string, string> = {
      name: 'Name',
      brand: 'Brand',
      category: 'Category',
      variant: 'Variant',
      position: 'Position',
      coupon: 'Coupon Code',
    };
    const passed = [
      'sku',
      'product_id',
      'price',
      'quantity',
      'currency',
      'products',
    ];
    const renamed = (
      values: Record<string, unknown> = {},
      names: Record<string, string>
    ) =>
      Object.fromEntries(
        Object.entries(values)
          .filter(([key]) => !passed.includes(key))
          .map(([key, value]) => [names[key] ?? key, value])
      );
    const plugin = new BrazePlugin({
      transformPurchase: (purchase, { order: purchaseOrder, product }) => ({
        ...purchase,
        properties: {
          ...renamed(purchaseOrder, orderNames),
          ...renamed(product, productNames),
        },
      }),
    });
    plugin.track({
      type: 'track',
      event: 'Order Completed',
      properties: {
        order_id: 'o1',
        revenue: 25,
        currency: 'USD',
        products: [
          {
            sku: 'SKU1',
            name: 'Shirt',
            price: 10,
            quantity: 2,
            brand: 'Equinox',
            coupon: 'C1',
          },
        ],
      },
    } as unknown as TrackEventType);

    expect(logPurchase).toHaveBeenCalledWith('SKU1', '10', 'USD', 2, {
      'Transaction Id': 'o1',
      'Total Amount': 25,
      'Name': 'Shirt',
      'Brand': 'Equinox',
      'Coupon Code': 'C1',
    });
  });

  it('passes no product to transformPurchase for per-order purchases', () => {
    const transformPurchase = jest.fn((p: BrazePurchase) => p);
    const plugin = new BrazePlugin({
      bundleCommerceEvents: true,
      transformPurchase,
    });
    plugin.track(order);

    expect(transformPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'Order Completed' }),
      { event: order, order: order.properties, product: undefined }
    );
  });

  it('skips purchases when transformPurchase returns null', () => {
    const plugin = new BrazePlugin({
      transformPurchase: (p, { product }) =>
        product?.sku !== undefined ? p : null,
    });
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledTimes(1);
    expect(logPurchase).toHaveBeenCalledWith(
      'SKU1',
      '10',
      'EUR',
      2,
      expect.any(Object)
    );
  });

  it('logs the default purchase and warns when transformPurchase throws', () => {
    const error = new Error('boom');
    const plugin = new BrazePlugin({
      transformPurchase: (p) => {
        p.properties.mutated = true;
        throw error;
      },
    });
    const warn = withWarn(plugin);
    plugin.track(order);

    expect(logPurchase).toHaveBeenCalledTimes(2);
    expect(logPurchase).toHaveBeenCalledWith(
      'SKU1',
      '10',
      'EUR',
      2,
      expect.not.objectContaining({ mutated: true })
    );
    expect(warn).toHaveBeenCalledWith(expect.any(String), error);
  });

  it('skips and warns when transformPurchase returns no productId', () => {
    const plugin = new BrazePlugin({
      transformPurchase: (p) => ({ ...p, productId: '' }),
    });
    const warn = withWarn(plugin);
    plugin.track(order);

    expect(logPurchase).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('rejects constructor options that another option makes unused', () => {
    const options: BrazePluginOptions[] = [
      // @ts-expect-error isPurchaseEvent overrides purchaseEventNames
      { purchaseEventNames: ['Order Completed'], isPurchaseEvent: () => true },
      // @ts-expect-error isPurchaseEvent overrides purchaseEventNames
      { isPurchaseEvent: () => true, purchaseEventNames: ['Order Completed'] },
      // @ts-expect-error bundled purchases use the event name as productId
      { bundleCommerceEvents: true, purchaseProductIdentifier: 'sku' },
      { bundleCommerceEvents: false, purchaseProductIdentifier: 'name' },
    ];
    expect(options).toHaveLength(4);
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
    expect(logCustomEvent).toHaveBeenCalledWith('Home', { $tab: 'feed' });
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
