import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/Button';
import { Txt } from '@/components/Text';
import { addDays, formatMonth, parts, type ISODate } from '@/lib/dates';
import { STAY_LIMITS } from '@/lib/pricing';
import { colors } from '@/theme/tokens';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthGrid(year: number, month: number): (ISODate | null)[] {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lead = (parts(first).weekday + 6) % 7; // Monday-first
  const days: (ISODate | null)[] = Array(lead).fill(null);
  for (let d = first; parts(d).month === month; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  return days;
}

/**
 * Range calendar from the "Dates & guests" frame: ink start/end, grey nights
 * in between, past days disabled. Picking a day sets check-in, the next pick
 * sets check-out (or restarts if it's not after check-in).
 */
export function RangeCalendar({
  checkIn,
  checkOut,
  today,
  onChange,
}: {
  checkIn: ISODate;
  checkOut: ISODate | null;
  today: ISODate;
  onChange: (checkIn: ISODate, checkOut: ISODate | null) => void;
}) {
  const start = parts(checkIn);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const days = monthGrid(cursor.year, cursor.month);
  const lastBookable = addDays(today, STAY_LIMITS.maxAdvanceDays);
  const todayParts = parts(today);
  const canPrev = cursor.year > todayParts.year || cursor.month > todayParts.month;

  const move = (delta: number) => {
    const m = cursor.month + delta;
    setCursor({ year: cursor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  const pick = (d: ISODate) => {
    if (checkOut === null && d > checkIn) {
      onChange(checkIn, addDays(checkIn, STAY_LIMITS.maxNights) < d ? addDays(checkIn, STAY_LIMITS.maxNights) : d);
    } else {
      onChange(d, null);
    }
  };

  const rows: (ISODate | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.month}>
        <IconButton icon="chevron-left" label="Previous month" look="grey" size={36} iconSize={16} onPress={() => move(-1)} disabled={!canPrev} />
        <Txt variant="rowTitle" accessibilityRole="header">
          {formatMonth(cursor.year, cursor.month)}
        </Txt>
        <IconButton icon="chevron-right" label="Next month" look="grey" size={36} iconSize={16} onPress={() => move(1)} />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <Txt key={w} variant="caption" color="text3" align="center" style={styles.cell}>
            {w}
          </Txt>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.week}>
          {row.map((d, j) => {
            if (!d) return <View key={j} style={styles.cell} />;
            const disabled = d < today || d > lastBookable;
            const isStart = d === checkIn;
            const isEnd = d === checkOut;
            const inside = checkOut !== null && d > checkIn && d < checkOut;
            const label = `${parts(d).day} ${formatMonth(parts(d).year, parts(d).month)}${isStart ? ', check-in' : isEnd ? ', check-out' : ''}`;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled, selected: isStart || isEnd }}
                disabled={disabled}
                onPress={() => pick(d)}
                style={[
                  styles.cell,
                  styles.day,
                  inside ? { backgroundColor: colors.chip } : null,
                  isStart || isEnd ? { backgroundColor: colors.ink } : null,
                  isStart && checkOut ? { borderTopLeftRadius: 21, borderBottomLeftRadius: 21 } : null,
                  isEnd ? { borderTopRightRadius: 21, borderBottomRightRadius: 21 } : null,
                  isStart && !checkOut ? { borderRadius: 21 } : null,
                ]}
              >
                <Txt variant="body" size={15} color={isStart || isEnd ? 'onInk' : disabled ? 'text3' : 'text'}>
                  {parts(d).day}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  week: { flexDirection: 'row' },
  cell: { flex: 1 },
  day: { height: 42, alignItems: 'center', justifyContent: 'center' },
});
