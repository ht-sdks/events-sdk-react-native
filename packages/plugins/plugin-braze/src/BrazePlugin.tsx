import {
  DestinationPlugin,
  IdentifyEventType,
  isNumber,
  isString,
  isBoolean,
  isDate,
  PluginType,
  TrackEventType,
  ScreenEventType,
  HightouchClient,
  HightouchEvent,
  isObject,
  objectToString,
  HightouchAPISettings,
  UpdateType,
  JsonMap,
  unknownToString,
} from '@ht-sdks/events-sdk-react-native';
import { createStore, Store } from '@ht-sdks/sovran-react-native';
import Braze, { GenderTypes, MonthsAsNumber } from '@braze/react-native-sdk';
import flush from './methods/flush';

export interface BrazePluginOptions {
  /** Track event names logged as purchases. Exact, case-sensitive match. */
  purchaseEventNames?: string[];
  /**
   * Decides which track events are purchases, overriding `purchaseEventNames`
   * and `logPurchaseWhenRevenuePresent`. Constructor only.
   */
  isPurchaseEvent?: (event: TrackEventType) => boolean;
  logPurchaseWhenRevenuePresent?: boolean;
  /** Product field used as the Braze purchase productId. Defaults to `sku`. */
  purchaseProductIdentifier?: 'sku' | 'name';
  bundleCommerceEvents?: boolean;
  forwardScreenViews?: boolean;
  stringifyAttributeValues?: boolean;
}

type SubscriptionType = Parameters<
  typeof Braze.setEmailNotificationSubscriptionType
>[0];

interface AttributeCache {
  userId?: string;
  attributes: Record<string, string>;
}

const GENDERS: Record<string, GenderTypes[keyof GenderTypes]> = {
  m: 'm',
  male: 'm',
  f: 'f',
  female: 'f',
  o: 'o',
  other: 'o',
  u: 'u',
  unknown: 'u',
  n: 'n',
  not_applicable: 'n',
  p: 'p',
  prefer_not_to_say: 'p',
};

const SUBSCRIPTION_TYPES: Record<string, SubscriptionType> = {
  opted_in: 'optedin',
  subscribed: 'subscribed',
  unsubscribed: 'unsubscribed',
};

const RESERVED_TRAITS = [
  'firstName',
  'first_name',
  '$FirstName',
  'lastName',
  'last_name',
  '$LastName',
  'email',
  'Email',
  'phone',
  '$Mobile',
  'gender',
  '$Gender',
  'birthday',
  'dob',
  'age',
  '$Age',
  'address',
  'home_city',
  '$City',
  'country',
  '$Country',
  '$Zip',
  'email_subscribe',
  'push_subscribe',
];

const DEFAULT_PURCHASE_EVENT_NAMES = ['Order Completed', 'Completed Order'];

const stripLeadingDollar = (key: string) => key.replace(/^\$+/, '');

interface AttributionProperties {
  network: string;
  campaign: string;
  adGroup: string;
  creative: string;
}

const defaultProperties: AttributionProperties = {
  network: '',
  campaign: '',
  adGroup: '',
  creative: '',
};

export class BrazePlugin extends DestinationPlugin {
  type = PluginType.destination;
  key = 'Appboy';
  private options: BrazePluginOptions;
  private settings: BrazePluginOptions;
  private userId?: string;
  private cache: AttributeCache = { attributes: {} };
  private cacheStore?: Store<AttributeCache>;
  private cacheRestored: Promise<void> = Promise.resolve();

  constructor(options: BrazePluginOptions = {}) {
    super();
    this.options = options;
    this.settings = options;
  }

  update(settings: HightouchAPISettings, _: UpdateType) {
    const brazeSettings = settings.integrations[this.key];
    this.settings = {
      ...(isObject(brazeSettings) ? brazeSettings : {}),
      ...this.options,
    };
  }

  configure(analytics: HightouchClient) {
    super.configure(analytics);
    const config = analytics.getConfig();
    this.cacheRestored = new Promise((resolve) => {
      this.cacheStore = createStore<AttributeCache>(
        { attributes: {} },
        {
          persist: {
            storeId: `${config.writeKey}-braze-attributes`,
            persistor: config.storePersistor,
            saveDelay: config.storePersistorSaveDelay,
            onInitialized: (restored) => {
              const state = restored as AttributeCache;
              this.cache = state;
              this.userId ??= state.userId;
              resolve();
            },
          },
        }
      );
    });
  }

  async execute(event: HightouchEvent) {
    const integrations = event.integrations;
    if (integrations?.All === false && integrations[this.key] !== true) {
      return undefined;
    }
    return super.execute(event);
  }

  async reset() {
    this.userId = undefined;
    await this.cacheRestored;
    this.cache = { attributes: {} };
    await this.cacheStore?.dispatch(() => this.cache);
  }

  private formatValue = (value: unknown) => {
    if (
      this.settings.stringifyAttributeValues !== true ||
      value === null ||
      value === undefined ||
      isString(value)
    ) {
      return value;
    }
    if (isDate(value)) {
      return value.toISOString();
    }
    if (Array.isArray(value) || isObject(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  };

  private formatProperties = (properties?: Record<string, unknown>) => {
    if (properties === undefined) {
      return undefined;
    }
    const formatted: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, value]) => {
      if (value !== undefined) {
        formatted[stripLeadingDollar(key)] = this.formatValue(value);
      }
    });
    return formatted;
  };

  /**
   * Cleans up the attributes to only send valid values to Braze SDK
   * @param value value of any type
   * @returns value if type is valid, undefined if the type is not supported by Braze
   */
  private sanitizeAttribute = (
    value: unknown
  ): string | number | boolean | Date | string[] | null | undefined => {
    // All basic values
    if (
      value === null ||
      isNumber(value) ||
      isString(value) ||
      isBoolean(value) ||
      isDate(value)
    ) {
      return this.formatValue(value) as string | number | boolean | Date | null;
    }

    // Arrays and objects we will attempt to serialize
    if (Array.isArray(value)) {
      return value.map((v) => {
        if (isObject(v)) {
          return objectToString(v) ?? '';
        }
        return `${v}`;
      });
    }

    if (isObject(value)) {
      return objectToString(value);
    }

    return undefined;
  };

  private parseDate = (
    value: unknown
  ): [number, MonthsAsNumber, number] | undefined => {
    // Date-only strings parse as UTC midnight, which is the previous day in
    // time zones behind UTC, so read the calendar date from the string.
    const match = isString(value)
      ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
      : null;
    if (match) {
      return [
        Number(match[1]),
        Number(match[2]) as MonthsAsNumber,
        Number(match[3]),
      ];
    }
    const date = isDate(value)
      ? value
      : isString(value) || isNumber(value)
      ? new Date(value)
      : undefined;
    if (date === undefined || isNaN(date.getTime())) {
      return undefined;
    }
    return [
      date.getFullYear(),
      // getMonth is zero indexed
      (date.getMonth() + 1) as MonthsAsNumber,
      date.getDate(),
    ];
  };

  identify(event: IdentifyEventType) {
    const userId = event.userId ?? undefined;
    // Stays synchronous so events tracked right after identify aren't
    // attributed to the previous Braze user.
    if (userId !== undefined && userId !== this.userId) {
      Braze.changeUser(userId);
      this.userId = userId;
    }
    return this.updateAttributes(event, userId);
  }

  private async updateAttributes(event: IdentifyEventType, userId?: string) {
    await this.cacheRestored;
    if (userId !== undefined && userId !== this.cache.userId) {
      this.cache = { userId, attributes: {} };
    }
    const sent = this.cache.attributes;
    const setIfChanged = (key: string, value: unknown, send: () => void) => {
      const serialized = JSON.stringify(value);
      if (sent[key] !== serialized) {
        send();
        sent[key] = serialized;
      }
    };
    const traits = (event.traits ?? {}) as Record<string, unknown>;
    const address = isObject(traits.address) ? traits.address : {};
    const pick = (...values: unknown[]) => values.find((v) => v !== undefined);
    const pickString = (...values: unknown[]) => {
      const value = pick(...values);
      return isString(value) ? value : undefined;
    };

    const stringSetters: [string, string | undefined, (v: string) => void][] = [
      [
        '$firstName',
        pickString(traits.firstName, traits.first_name, traits.$FirstName),
        (v) => Braze.setFirstName(v),
      ],
      [
        '$lastName',
        pickString(traits.lastName, traits.last_name, traits.$LastName),
        (v) => Braze.setLastName(v),
      ],
      [
        '$email',
        pickString(traits.email, traits.Email),
        (v) => Braze.setEmail(v),
      ],
      [
        '$phone',
        pickString(traits.phone, traits.$Mobile),
        (v) => Braze.setPhoneNumber(v),
      ],
      [
        '$homeCity',
        pickString(address.city, traits.home_city, traits.$City),
        (v) => Braze.setHomeCity(v),
      ],
      [
        '$country',
        pickString(address.country, traits.country, traits.$Country),
        (v) => Braze.setCountry(v),
      ],
    ];
    stringSetters.forEach(([key, value, setter]) => {
      if (value !== undefined) {
        setIfChanged(key, value, () => setter(value));
      }
    });

    const gender = pick(traits.gender, traits.$Gender);
    if (gender !== undefined && gender !== null) {
      const normalized =
        GENDERS[
          String(gender)
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_')
        ];
      if (normalized !== undefined) {
        setIfChanged('$gender', normalized, () => Braze.setGender(normalized));
      } else {
        this.analytics?.logger.warn(
          `Gender "${String(gender)}" is not a supported Braze gender value.`
        );
      }
    }

    const birthday = pick(traits.birthday, traits.dob);
    const age = pick(traits.age, traits.$Age);
    if (birthday !== undefined && birthday !== null) {
      const dateOfBirth = this.parseDate(birthday);
      if (dateOfBirth !== undefined) {
        setIfChanged('$dateOfBirth', dateOfBirth, () =>
          Braze.setDateOfBirth(...dateOfBirth)
        );
      } else {
        this.analytics?.logger.warn(
          `Birthday found "${String(
            birthday
          )}" could not be parsed as a Date. Try converting to ISO format.`
        );
      }
    } else if (isNumber(age)) {
      const year = new Date().getFullYear() - age;
      setIfChanged('$dateOfBirth', [year, 1, 1], () =>
        Braze.setDateOfBirth(year, 1, 1)
      );
    }

    const subscriptions: [string, unknown, (v: SubscriptionType) => void][] = [
      [
        '$emailSubscribe',
        traits.email_subscribe,
        (v) => Braze.setEmailNotificationSubscriptionType(v),
      ],
      [
        '$pushSubscribe',
        traits.push_subscribe,
        (v) => Braze.setPushNotificationSubscriptionType(v),
      ],
    ];
    subscriptions.forEach(([key, value, setter]) => {
      const type = isString(value) ? SUBSCRIPTION_TYPES[value] : undefined;
      if (type !== undefined) {
        setIfChanged(key, type, () => setter(type));
      }
    });

    const customAttributes = Object.entries(traits).filter(
      ([key]) => !RESERVED_TRAITS.includes(key)
    );
    const zip = pick(address.postalCode, traits.$Zip);
    if (zip !== undefined) {
      customAttributes.push(['Zip', zip]);
    }
    customAttributes.forEach(([rawKey, value]) => {
      const key = stripLeadingDollar(rawKey);
      if (key === '') {
        return;
      }
      if (value === null) {
        // The bridge ignores null in setCustomUserAttribute.
        setIfChanged(key, null, () => Braze.unsetCustomUserAttribute(key));
        return;
      }
      const sanitized = this.sanitizeAttribute(value);
      if (sanitized !== undefined) {
        setIfChanged(key, sanitized, () =>
          Braze.setCustomUserAttribute(key, sanitized)
        );
      }
    });

    await this.cacheStore?.dispatch(() => ({
      ...this.cache,
      attributes: { ...sent },
    }));
    return event;
  }

  track(event: TrackEventType) {
    const eventName = event.event;

    if (event.event === 'Install Attributed') {
      if (
        event.properties?.campaign !== undefined &&
        event.properties?.campaign !== null
      ) {
        const attributionData: unknown = event.properties.campaign;
        let network: string,
          campaign: string,
          adGroup: string,
          creative: string;

        if (isObject(attributionData)) {
          network =
            unknownToString(
              attributionData.source,
              true,
              undefined,
              undefined
            ) ?? defaultProperties.network;
          campaign =
            unknownToString(attributionData.name, true, undefined, undefined) ??
            defaultProperties.campaign;
          adGroup =
            unknownToString(
              attributionData.ad_group,
              true,
              undefined,
              undefined
            ) ?? defaultProperties.adGroup;
          creative =
            unknownToString(
              attributionData.ad_creative,
              true,
              undefined,
              undefined
            ) ?? defaultProperties.creative;
        } else {
          network = defaultProperties.network;
          campaign = defaultProperties.campaign;
          adGroup = defaultProperties.adGroup;
          creative = defaultProperties.creative;
        }
        Braze.setAttributionData(network, campaign, adGroup, creative);
      }
    }

    if (this.isPurchase(event)) {
      this.logPurchaseEvent(event);
    } else {
      Braze.logCustomEvent(
        stripLeadingDollar(eventName),
        this.formatProperties(event.properties)
      );
    }
    return event;
  }

  private isPurchase(event: TrackEventType) {
    // Read from options, not settings: a function can't come from JSON settings.
    const { isPurchaseEvent } = this.options;
    if (isPurchaseEvent !== undefined) {
      try {
        return isPurchaseEvent(event);
      } catch (error) {
        this.analytics?.logger.warn(
          `isPurchaseEvent threw for "${event.event}"; logging it as a custom event.`,
          error
        );
        return false;
      }
    }
    const names = Array.isArray(this.settings.purchaseEventNames)
      ? this.settings.purchaseEventNames
      : DEFAULT_PURCHASE_EVENT_NAMES;
    const revenue = this.extractRevenue(event.properties, 'revenue');
    return (
      names.includes(event.event) ||
      (this.settings.logPurchaseWhenRevenuePresent === true &&
        revenue !== 0 &&
        revenue !== undefined)
    );
  }

  screen(event: ScreenEventType) {
    if (this.settings.forwardScreenViews === true) {
      Braze.logCustomEvent(
        stripLeadingDollar(event.name),
        this.formatProperties(event.properties)
      );
    }
    return event;
  }

  flush() {
    flush();
  }

  extractRevenue = (properties: JsonMap | undefined, key: string) => {
    if (!properties) {
      return 0;
    }

    const revenue = properties[key];
    if (revenue !== undefined && revenue !== null) {
      switch (typeof revenue) {
        case 'string':
          return parseFloat(revenue);
        case 'number':
          return revenue;
        default:
          return 0;
      }
    } else {
      return 0;
    }
  };

  logPurchaseEvent(event: TrackEventType) {
    // Make USD as the default currency.
    let currency = 'USD';
    const revenue =
      this.extractRevenue(event.properties, 'revenue') ||
      this.extractRevenue(event.properties, 'total');
    if (
      typeof event.properties?.currency === 'string' &&
      event.properties.currency.length === 3
    ) {
      currency = event.properties.currency;
    }
    const orderProperties: Record<string, unknown> = { ...event.properties };
    const products = Array.isArray(orderProperties.products)
      ? orderProperties.products.filter(isObject)
      : [];
    if (orderProperties.order_id !== undefined) {
      orderProperties['Transaction Id'] = orderProperties.order_id;
    }
    delete orderProperties.currency;
    delete orderProperties.revenue;
    delete orderProperties.products;
    delete orderProperties.order_id;

    if (this.settings.bundleCommerceEvents === true) {
      Braze.logPurchase(
        'eCommerce - purchase',
        String(revenue),
        currency,
        1,
        this.formatProperties({
          ...orderProperties,
          products: products.map(({ sku, coupon, ...product }) => ({
            ...product,
            ...(sku !== undefined && { Id: sku }),
            ...(coupon !== undefined && { 'Coupon Code': coupon }),
            'Total Product Amount':
              this.extractRevenue(product as JsonMap, 'price') *
              (isNumber(product.quantity) ? product.quantity : 1),
          })),
        })
      );
      return;
    }

    if (products.length === 0) {
      Braze.logPurchase(
        stripLeadingDollar(event.event),
        String(revenue),
        currency,
        1,
        this.formatProperties(orderProperties)
      );
      return;
    }

    products.forEach((product) => {
      const {
        product_id: productId,
        sku,
        name,
        brand,
        category,
        variant,
        position,
        coupon,
        price,
        quantity,
        ...customFields
      } = product;
      const identifier =
        this.settings.purchaseProductIdentifier === 'name'
          ? name
          : sku ?? productId;
      Braze.logPurchase(
        unknownToString(identifier, true, undefined, undefined) ?? '',
        String(this.extractRevenue({ price } as JsonMap, 'price')),
        currency,
        isNumber(quantity) ? quantity : 1,
        this.formatProperties({
          ...orderProperties,
          'Name': name,
          'Brand': brand,
          'Category': category,
          'Variant': variant,
          'Position': position,
          'Coupon Code': coupon,
          ...customFields,
        })
      );
    });
  }
}
