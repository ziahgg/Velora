import { addDays, formatRange, isISODate, nightsBetween, rangesOverlap } from '../dates';
import { formatUSD, formatUSDShort, percentOf } from '../money';
import { fitsParty, formatRate, freeCancelUntil, quoteStay, validateStay } from '../pricing';

describe('dates', () => {
  it('counts nights as calendar days, ignoring time zones and DST', () => {
    expect(nightsBetween('2026-11-12', '2026-11-16')).toBe(4);
    expect(nightsBetween('2026-03-28', '2026-03-30')).toBe(2); // EU DST change
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(nightsBetween('2026-11-16', '2026-11-12')).toBe(-4);
  });

  it('adds days across month and leap-year boundaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-11-12', -2)).toBe('2026-11-10');
  });

  it('validates ISO dates', () => {
    expect(isISODate('2026-11-12')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('12/11/2026')).toBe(false);
  });

  it('treats a check-out day as free for the next check-in', () => {
    expect(rangesOverlap('2026-11-12', '2026-11-16', '2026-11-16', '2026-11-18')).toBe(false);
    expect(rangesOverlap('2026-11-12', '2026-11-16', '2026-11-15', '2026-11-18')).toBe(true);
  });

  it('formats ranges like the design', () => {
    expect(formatRange('2026-11-12', '2026-11-16')).toBe('12 – 16 Nov');
    expect(formatRange('2026-11-28', '2026-12-02')).toBe('28 Nov – 2 Dec');
  });
});

describe('money', () => {
  it('formats integer cents as USD', () => {
    expect(formatUSD(264760)).toBe('$2,647.60');
    expect(formatUSDShort(57900)).toBe('$579');
    expect(formatUSDShort(57950)).toBe('$579.50');
  });

  it('rejects non-integer cents', () => {
    expect(() => formatUSD(10.5)).toThrow();
  });

  it('rounds percentages half-up to the cent (same as SQL)', () => {
    expect(percentOf(231600, 1000)).toBe(23160);
    expect(percentOf(105, 1000)).toBe(11); // 10.5 → 11
    expect(percentOf(104, 1000)).toBe(10); // 10.4 → 10
    expect(percentOf(333, 1300)).toBe(43); // 43.29 → 43
  });
});

describe('quoteStay', () => {
  it('reproduces the Figma price details exactly', () => {
    const q = quoteStay({ nightlyRateCents: 57900, checkIn: '2026-11-12', checkOut: '2026-11-16', rooms: 1, taxRateBps: 1000, resortFeePerNightCents: 2500 });
    expect(q).toMatchObject({ nights: 4, subtotalCents: 231600, taxCents: 23160, feesCents: 10000, totalCents: 264760 });
  });

  it('multiplies by rooms and keeps totals as integers', () => {
    const q = quoteStay({ nightlyRateCents: 89000, checkIn: '2026-11-30', checkOut: '2026-12-02', rooms: 2, taxRateBps: 1000, resortFeePerNightCents: 2500 });
    expect(q.subtotalCents).toBe(356000);
    expect(q.totalCents).toBe(356000 + 35600 + 10000);
    expect(Number.isInteger(q.totalCents)).toBe(true);
  });

  it('refuses zero-night stays and zero rooms', () => {
    expect(() => quoteStay({ nightlyRateCents: 100, checkIn: '2026-11-12', checkOut: '2026-11-12', rooms: 1, taxRateBps: 0, resortFeePerNightCents: 0 })).toThrow();
    expect(() => quoteStay({ nightlyRateCents: 100, checkIn: '2026-11-12', checkOut: '2026-11-13', rooms: 0, taxRateBps: 0, resortFeePerNightCents: 0 })).toThrow();
  });

  it('derives the free cancellation date and rate label', () => {
    expect(freeCancelUntil('2026-11-12', 2)).toBe('2026-11-10');
    expect(freeCancelUntil('2026-11-12', null)).toBeNull();
    expect(formatRate(1000)).toBe('10%');
    expect(formatRate(1250)).toBe('12.5%');
  });
});

describe('validateStay', () => {
  const today = '2026-10-25';
  const ok = { checkIn: '2026-11-12', checkOut: '2026-11-16', adults: 2, children: 1, rooms: 1 };

  it('accepts a normal stay', () => {
    expect(validateStay(ok, today)).toBeNull();
  });

  it('requires check-out after check-in', () => {
    expect(validateStay({ ...ok, checkOut: '2026-11-12' }, today)).toMatch(/after check-in/);
    expect(validateStay({ ...ok, checkOut: '2026-11-10' }, today)).toMatch(/after check-in/);
  });

  it('rejects past check-in, very long stays and far-future dates', () => {
    expect(validateStay({ ...ok, checkIn: '2026-10-20', checkOut: '2026-10-22' }, today)).toMatch(/past/);
    expect(validateStay({ ...ok, checkOut: '2026-12-20' }, today)).toMatch(/30 nights/);
    expect(validateStay({ ...ok, checkIn: '2027-12-01', checkOut: '2027-12-03' }, today)).toMatch(/year/);
  });

  it('validates guests and rooms', () => {
    expect(validateStay({ ...ok, adults: 0 }, today)).toMatch(/adult/);
    expect(validateStay({ ...ok, children: 7 }, today)).toMatch(/children/);
    expect(validateStay({ ...ok, rooms: 5 }, today)).toMatch(/rooms/);
    expect(validateStay({ ...ok, adults: 1, rooms: 2 }, today)).toMatch(/Each room/);
  });

  it('checks room capacity for the party', () => {
    expect(fitsParty(3, { adults: 2, children: 1, rooms: 1 })).toBe(true);
    expect(fitsParty(2, { adults: 2, children: 1, rooms: 1 })).toBe(false);
    expect(fitsParty(2, { adults: 2, children: 1, rooms: 2 })).toBe(true);
  });
});
