/**
 * Money is always an integer number of US cents. Formatting is the only place
 * cents become dollars; nothing in the app does arithmetic on dollar floats.
 */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) throw new Error(`Money must be whole cents, got ${value}`);
}

const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** $2,647.60 */
export function formatUSD(cents: Cents): string {
  assertCents(cents);
  return usd2.format(cents / 100);
}

/** $579 — for nightly prices, which are whole dollars in the catalog. Falls back to cents when needed. */
export function formatUSDShort(cents: Cents): string {
  assertCents(cents);
  return cents % 100 === 0 ? usd0.format(cents / 100) : usd2.format(cents / 100);
}

/** Percent of an amount in basis points, rounded half-up to the cent (matches the database). */
export function percentOf(cents: Cents, basisPoints: number): Cents {
  assertCents(cents);
  if (!Number.isInteger(basisPoints) || basisPoints < 0) throw new Error('Rate must be whole basis points');
  return Math.floor((cents * basisPoints + 5000) / 10000);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => {
    assertCents(b);
    return a + b;
  }, 0);
}
