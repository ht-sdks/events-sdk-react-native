/** Validate a purchase price or quantity without coercion or partial-string parsing. */
export const purchaseNumber = (
  value: unknown,
  field: 'price' | 'quantity'
): number => {
  const text = typeof value === 'string' ? value.trim() : undefined;
  const number =
    typeof value === 'number'
      ? value
      : text !== undefined &&
        /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(text)
      ? Number(text)
      : NaN;
  if (
    !Number.isFinite(number) ||
    (field === 'quantity' &&
      (!Number.isInteger(number) || number < 1 || number > 100))
  ) {
    throw new RangeError(
      `Braze purchase rejected: ${field} must be ${
        field === 'price'
          ? 'explicitly supplied as a finite number'
          : 'an integer from 1 to 100'
      }.`
    );
  }
  return number;
};
