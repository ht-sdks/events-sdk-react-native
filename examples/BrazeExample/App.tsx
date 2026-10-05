import * as React from 'react';
import {useState} from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {createClient} from '@ht-sdks/events-sdk-react-native';
import {BrazePlugin} from '@ht-sdks/events-sdk-react-native-plugin-braze';

// Flip and reload to log one purchase per order.
const perOrder = false;

const client = createClient({
  writeKey: '72b7caa5de8f082b6526c56ef42c8ee4bf9cd73daf6bc307b067db3692e61e9b',
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
    purchaseDetection: [
      'Order Completed',
      'Completed Order',
      'Membership Purchased',
    ],
    purchaseGrouping: perOrder
      ? {mode: 'perOrder'}
      : {mode: 'perProduct', identifier: 'sku'},
  }),
});

const names = ['Jane', 'Bob', 'Ada', 'Maya', 'Luis', 'Priya', 'Omar', 'Chen'];

const randomId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

const randomName = () => names[Math.floor(Math.random() * names.length)];

const traits = (firstName: string, plan: string) => ({
  email: `${firstName.trim().toLowerCase().replace(/\s+/g, '')}@example.com`,
  firstName,
  gender: 'male',
  plan,
  address: {city: 'New York', country: 'US'},
});

const actions: {
  label: string;
  run: (userId: string, firstName: string) => Promise<void>;
}[] = [
  {
    label: 'Identify',
    run: (userId, firstName) =>
      client.identify(userId, traits(firstName, 'pro')),
  },
  {
    label: 'Identify again',
    run: (userId, firstName) =>
      client.identify(userId, traits(firstName, 'pro')),
  },
  {
    label: 'Change plan',
    run: (userId, firstName) =>
      client.identify(userId, traits(firstName, 'enterprise')),
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
    label: 'Flush',
    run: () => client.flush(),
  },
  {
    label: 'Reset',
    run: () => client.reset(),
  },
];

const App = () => {
  const [lastAction, setLastAction] = useState<string>();
  const [userId, setUserId] = useState(randomId);
  const [firstName, setFirstName] = useState(randomName);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.last}>Last action: {lastAction ?? 'none'}</Text>
      <ScrollView contentContainerStyle={styles.column}>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="User ID"
        />
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          autoCorrect={false}
          placeholder="First name"
        />
        <View style={styles.button}>
          <Button
            title="New user"
            onPress={() => {
              setUserId(randomId());
              setFirstName(randomName());
              setLastAction('New user');
            }}
          />
        </View>
        {actions.map(action => (
          <View key={action.label} style={styles.button}>
            <Button
              title={action.label}
              onPress={() => {
                setLastAction(action.label);
                void action.run(userId, firstName);
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  button: {
    marginBottom: 8,
  },
});

export default App;
