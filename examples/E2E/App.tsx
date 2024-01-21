import 'react-native-gesture-handler';
import * as React from 'react';
// import RNBootSplash from 'react-native-bootsplash';
import {
  NavigationContainer,
  NavigationState,
  PartialState,
} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {
  createClient,
  AnalyticsProvider,
  CountFlushPolicy,
  // @ts-ignore unused for e2e tests
  // StartupFlushPolicy,
  // @ts-ignore unused for e2e tests
  // TimerFlushPolicy,
} from '@ht-sdks/analytics-react-native';
import Home from './Home';
import SecondPage from './SecondPage';
import Modal from './Modal';
import {useState} from 'react';
import {Logger} from './plugins/Logger';
import {Platform} from 'react-native';

// import {AmplitudeSessionPlugin} from '@ht-sdks/analytics-react-native-plugin-amplitude-session';
// import { ConsentManager } from './plugins/ConsentManager';
// import { FirebasePlugin } from '@ht-sdks/analytics-react-native-plugin-firebase';
// import { FacebookAppEventsPlugin } from '@ht-sdks/analytics-react-native-plugin-facebook-app-events';
// import { IdfaPlugin } from '@ht-sdks/analytics-react-native-plugin-idfa';
// import { AdvertisingIdPlugin } from '@ht-sdks/analytics-react-native-plugin-advertising-id';
// import { ClevertapPlugin } from '@ht-sdks/analytics-react-native-plugin-clevertap';
// import { BrazePlugin } from '@ht-sdks/analytics-react-native-plugin-braze';

const hightouchClient = createClient({
  writeKey: 'yup',
  maxBatchSize: 1000,
  trackDeepLinks: true,
  trackAppLifecycleEvents: true,
  autoAddHightouchDestination: true,
  collectDeviceId: true,
  debug: true,
  flushPolicies: [
    new CountFlushPolicy(5),
    // These are disabled for E2E tests
    // new TimerFlushPolicy(1000),
    // new StartupFlushPolicy(),
  ],
  proxy: Platform.select({
    ios: 'http://localhost:9091/events',
    android: 'http://10.0.2.2:9091/events',
  }),
  cdnProxy: Platform.select({
    ios: 'http://localhost:9091/settings',
    android: 'http://10.0.2.2:9091/settings',
  }),
});

const LoggerPlugin = new Logger();

hightouchClient.add({plugin: LoggerPlugin});

// To see an example Consent Manager uncomment the following
// const ConsentManagerPlugin = new ConsentManager();
// hightouchClient.add({ plugin: ConsentManagerPlugin });

// To test the Firebase plugin make sure to add your own API_KEY in example/ios/GoogleService-Info.plist
// hightouchClient.add({ plugin: new FirebasePlugin() });

// To test the Facebook App Events plugin make sure to add your Facebook App Id to Info.plist
// hightouchClient.add({ plugin: new FacebookAppEventsPlugin() });
// const idfaPlugin = new IdfaPlugin();
// hightouchClient.add({ plugin: idfaPlugin });

// hightouchClient.add({plugin: new AmplitudeSessionPlugin()});

// hightouchClient.add({ plugin: new BrazePlugin() });

// hightouchClient.add({ plugin: new ClevertapPlugin() });

// hightouchClient.add({
//   plugin: new AdvertisingIdPlugin(),
// });

const MainStack = createStackNavigator();
const RootStack = createStackNavigator();
function MainStackScreen() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#262e4f',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <MainStack.Screen
        name="Home"
        component={Home}
        options={{headerShown: false}}
      />
      <MainStack.Screen
        name="SecondPage"
        component={SecondPage}
        options={{title: 'Second Page'}}
      />
    </MainStack.Navigator>
  );
}

const getActiveRouteName = (
  state: NavigationState | PartialState<NavigationState> | undefined,
): string => {
  if (!state || typeof state.index !== 'number') {
    return 'Unknown';
  }

  const route = state.routes[state.index];

  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
};

const App = () => {
  // React.useEffect(() => {
  //   void RNBootSplash.hide();
  // }, []);

  const [routeName, setRouteName] = useState('Unknown');

  return (
    <AnalyticsProvider client={hightouchClient}>
      <NavigationContainer
        onStateChange={state => {
          const newRouteName = getActiveRouteName(state);

          if (routeName !== newRouteName) {
            void hightouchClient.screen(newRouteName);

            setRouteName(newRouteName);
          }
        }}>
        <RootStack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#262e4f',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            presentation: 'modal',
          }}>
          <RootStack.Screen
            name="Main"
            component={MainStackScreen}
            options={{headerShown: false}}
          />
          <RootStack.Screen
            name="Modal"
            component={Modal}
            options={{headerBackTitle: 'Go back'}}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </AnalyticsProvider>
  );
};

export default App;
