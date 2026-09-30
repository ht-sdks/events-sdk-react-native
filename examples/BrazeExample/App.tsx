import * as React from 'react';
import {useState} from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {createClient} from '@ht-sdks/events-sdk-react-native';
import {BrazePlugin} from '@ht-sdks/events-sdk-react-native-plugin-braze';

// Flip and reload to log one purchase per order.
const perOrder = false;

const client = createClient({
  writeKey: '<WRITE_KEY>',
  debug: true,
  defaultSettings: {
    integrations: {
      Appboy: {},
    },
  },
});

client.add({
  plugin: new BrazePlugin({
    forwardScreenViews: true,
    purchaseEventNames: [
      'Order Completed',
      'Completed Order',
      'Membership Purchased',
    ],
    ...(perOrder ? {bundleCommerceEvents: true as const} : {}),
  }),
});

const userA = {
  email: 'jane@example.com',
  firstName: 'Jane',
  gender: 'male',
  plan: 'pro',
  address: {city: 'New York', country: 'US'},
};

const actions: {label: string; run: () => Promise<void>}[] = [
  {
    label: 'Identify A',
    run: () => client.identify('user-a', userA),
  },
  {
    label: 'Identify A again',
    run: () => client.identify('user-a', userA),
  },
  {
    label: 'Change plan',
    run: () => client.identify('user-a', {...userA, plan: 'enterprise'}),
  },
  {
    label: 'Custom event',
    run: () => client.track('Class Booked', {class_type: 'Yoga'}),
  },
  {
    label: 'Purchase, two products',
    run: () =>
      client.track('Order Completed', {
        order_id: 'order-123',
        revenue: 42,
        tax: 3,
        currency: 'USD',
        products: [
          {
            sku: 'RB-100',
            name: 'Resistance Band',
            price: 15,
            quantity: 2,
            brand: 'Equinox',
            category: 'Gear',
          },
          {
            sku: 'MB-200',
            name: 'Mat',
            price: 12,
            quantity: 1,
            brand: 'Equinox',
            category: 'Gear',
          },
        ],
      }),
  },
  {
    label: 'Purchase, custom name',
    run: () =>
      client.track('Membership Purchased', {
        order_id: 'order-456',
        revenue: 99,
        currency: 'USD',
        products: [
          {
            sku: 'MEM-1',
            name: 'Monthly Membership',
            price: 99,
            quantity: 1,
          },
        ],
      }),
  },
  {
    label: 'Screen',
    run: () => client.screen('Schedule'),
  },
  {
    label: 'Opt-out event',
    run: () =>
      client.track('Private Event', {}, event => {
        event.integrations = {...event.integrations, Appboy: false};
        return event;
      }),
  },
  {
    label: 'Reset',
    run: () => client.reset(),
  },
  {
    label: 'Identify B',
    run: () =>
      client.identify('user-b', {email: 'bob@example.com', firstName: 'Bob'}),
  },
];

const App = () => {
  const [lastAction, setLastAction] = useState<string>();

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.last}>Last action: {lastAction ?? 'none'}</Text>
      <ScrollView contentContainerStyle={styles.column}>
        {actions.map(action => (
          <View key={action.label} style={styles.button}>
            <Button
              title={action.label}
              onPress={() => {
                setLastAction(action.label);
                void action.run();
              }}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  last: {
    padding: 16,
    fontSize: 16,
  },
  column: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  button: {
    marginBottom: 8,
  },
});

export default App;
