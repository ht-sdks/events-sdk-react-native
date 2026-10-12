export const resolvePurchaseCurrency = (
  value: unknown,
  defaultCurrency?: string
): string => {
  const normalize = (input: unknown): string | undefined => {
    if (typeof input !== 'string') return undefined;
    const code = input.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : undefined;
  };
  const currency = normalize(value);
  if (currency !== undefined) return currency;
  if (defaultCurrency === undefined) {
    throw new RangeError(
      'Braze purchase rejected: invalid or missing currency. Send a three-letter currency code or configure defaultCurrency.'
    );
  }
  const fallback = normalize(defaultCurrency);
  if (fallback === undefined) {
    throw new RangeError(
      'Braze purchase rejected: defaultCurrency must be a three-letter currency code.'
    );
  }
  return fallback;
};
