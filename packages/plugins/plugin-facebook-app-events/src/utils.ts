import {
  isNumber,
  isString,
  unknownToString,
} from '@ht-sdks/events-sdk-react-native';

export const sanitizeValue = (value: unknown): string | number | undefined => {
  if (isNumber(value) || isString(value)) {
    return value;
  }
  return unknownToString(value);
};
