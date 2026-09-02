// This is our basic setup for all JS Tests
// Factory is required because @react-native/jest-preset remaps
// `react-native` to the real package, which skips the manual mock.
jest.mock('react-native', () => jest.requireActual('../__mocks__/react-native'));
jest.mock('uuid');
jest.mock('react-native-get-random-values');
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock'
  )
);
