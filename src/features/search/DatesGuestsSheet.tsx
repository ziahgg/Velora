import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Feedback';
import { Stepper } from '@/components/Fields';
import { Txt } from '@/components/Text';
import { formatDay, nightsBetween, plural, todayISO } from '@/lib/dates';
import { STAY_LIMITS, validateStay, type StayInput } from '@/lib/pricing';
import { colors } from '@/theme/tokens';
import { RangeCalendar } from './Calendar';

/** Figma 07 "Dates & guests" sheet. Edits a draft and applies it only when valid. */
export function DatesGuestsSheet({ visible, stay, onClose, onApply }: { visible: boolean; stay: StayInput; onClose: () => void; onApply: (s: StayInput) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Dates & guests">
      {/* Remount per opening so the draft starts from the current trip. */}
      {visible ? <Body stay={stay} onApply={onApply} /> : null}
    </Sheet>
  );
}

function Body({ stay, onApply }: { stay: StayInput; onApply: (s: StayInput) => void }) {
  const today = todayISO();
  const [checkIn, setCheckIn] = useState(stay.checkIn < today ? today : stay.checkIn);
  const [checkOut, setCheckOut] = useState<string | null>(stay.checkOut);
  const [adults, setAdults] = useState(stay.adults);
  const [children, setChildren] = useState(stay.children);
  const [rooms, setRooms] = useState(stay.rooms);

  const draft: StayInput = { checkIn, checkOut: checkOut ?? checkIn, adults, children, rooms };
  const error = checkOut ? validateStay(draft, today) : 'Choose your check-out date.';
  const nights = checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const guests = adults + children;

  return (
    <>
      <View style={styles.range}>
        {/* The ink box is the date the next tap will set. */}
        <View style={[styles.box, checkOut ? styles.boxActive : styles.boxIdle]}>
          <Txt variant="caption" color={checkOut ? 'text3' : 'text2'}>
            Check-in
          </Txt>
          <Txt variant="label" color={checkOut ? 'onInk' : 'text'}>
            {formatDay(checkIn)}
          </Txt>
        </View>
        <View style={[styles.box, !checkOut ? styles.boxActive : styles.boxIdle]}>
          <Txt variant="caption" color={!checkOut ? 'text3' : 'text2'}>
            Check-out
          </Txt>
          <Txt variant="label" color={!checkOut ? 'onInk' : 'text'}>
            {checkOut ? formatDay(checkOut) : 'Select a date'}
          </Txt>
        </View>
      </View>

      <RangeCalendar
        checkIn={checkIn}
        checkOut={checkOut}
        today={today}
        onChange={(a, b) => {
          setCheckIn(a);
          setCheckOut(b);
        }}
      />

      <View style={styles.party}>
        <PartyRow title="Adults" hint="Ages 13+" value={adults} min={Math.max(1, rooms)} max={STAY_LIMITS.maxAdults} onChange={setAdults} />
        <PartyRow title="Children" hint="Ages 2–12" value={children} min={0} max={STAY_LIMITS.maxChildren} onChange={setChildren} />
        <PartyRow title="Rooms" value={rooms} min={1} max={Math.min(STAY_LIMITS.maxRooms, adults)} onChange={setRooms} />
      </View>

      {error && checkOut ? (
        <Txt variant="caption" color="error" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}

      <Button
        label={checkOut && !error ? `Apply · ${plural(nights, 'night')}, ${plural(guests, 'guest')}` : 'Choose your check-out date'}
        disabled={!!error}
        onPress={() => onApply(draft)}
      />
    </>
  );
}

function PartyRow({ title, hint, value, min, max, onChange }: { title: string; hint?: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.partyRow}>
      <View style={{ flex: 1 }}>
        <Txt variant="label">{title}</Txt>
        {hint ? (
          <Txt variant="caption" color="text2">
            {hint}
          </Txt>
        ) : null}
      </View>
      <Stepper label={title} value={value} min={min} max={max} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  range: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  boxActive: { backgroundColor: colors.ink },
  boxIdle: { backgroundColor: colors.bg },
  party: { backgroundColor: colors.bg, borderRadius: 24, padding: 14, gap: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
});
