// Usage: npm run test:db:local
// Executes the Velora migration + seed on PGlite (real Postgres in WASM) with a
// minimal stand-in for Supabase's auth schema and API roles, then runs the same
// scenarios as supabase/tests/database/booking_rls.test.sql as plain assertions.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();
let passed = 0;
let failed = 0;
const ok = (cond, name, extra = '') => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
`);

let migration = readFileSync(`${root}/supabase/migrations/20261025000100_init.sql`, 'utf8');
migration = migration.replace('create extension if not exists pgcrypto;', ''); // gen_random_uuid is built in
await db.exec(migration);
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
`);
await db.exec(readFileSync(`${root}/supabase/seed.sql`, 'utf8'));
ok(true, 'migration and seed apply cleanly');

await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'guest.a@test.dev', '{"full_name":"Guest A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'guest.b@test.dev', '{"full_name":"Guest B"}')`);
ok((await db.query(`select full_name from public.profiles where email = 'guest.a@test.dev'`)).rows[0]?.full_name === 'Guest A', 'new auth user gets a profile');

const as = async (who) => {
  await db.exec('reset role');
  if (who === 'anon') return db.exec(`set role anon; select set_config('request.jwt.claims', '', false);`);
  const sub = who === 'a' ? '00000000-0000-0000-0000-0000000000a1' : '00000000-0000-0000-0000-0000000000b2';
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${sub}"}', false);`);
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const throws = async (sql, pattern, name) => {
  try {
    await db.query(sql);
    ok(false, name, 'did not throw');
  } catch (e) {
    ok(pattern.test(e.message), name, pattern.test(e.message) ? '' : e.message);
  }
};
const book = (room, inOff, outOff, adults, children, rooms, total, key) =>
  `select * from public.create_booking('grand-horizon', '${room}', current_date + ${inOff}, current_date + ${outOff}, ${adults}, ${children}, ${rooms}, 'Guest A', '+62 852 3239 6140', '', ${total}, '${key}')`;

await as('anon');
ok(Number((await one('select count(*) from public.hotels')).count) === 13, 'anon can read the 13 sample hotels');
ok(Number((await one('select count(*) from public.bookings')).count) === 0, 'anon sees no bookings');
await throws(book('gh-ocean-villa', 18, 22, 2, 1, 1, 264760, 'anon-key-1'), /permission denied|auth/, 'anon cannot create bookings');
const avail = await db.query(`select * from public.room_availability(array['gh-ocean-villa','gh-family-villa'], current_date + 18, current_date + 22)`);
ok(avail.rows.length === 2 && avail.rows.find((r) => r.room_type_id === 'gh-ocean-villa').available === 4, 'availability is public and starts at inventory');

await as('a');
await throws(book('gh-ocean-villa', 18, 22, 2, 1, 1, 1, 'key-price-mismatch'), /price_changed/, 'client total that differs from the server price is rejected');
const b1 = await one(book('gh-ocean-villa', 18, 22, 2, 1, 1, 264760, 'key-booking-a-1'));
ok(Number(b1.total_cents) === 264760 && Number(b1.tax_cents) === 23160 && Number(b1.fees_cents) === 10000, 'server prices 4 nights at $2,647.60 (tax $231.60, fees $100)');
ok(b1.status === 'pending_payment' && b1.payment_status === 'unpaid' && /^VLR-48217$/.test(b1.reference), 'pending, unpaid, reference VLR-48217', `${b1.status} ${b1.reference}`);
ok(b1.hold_expires_at !== null, 'pending booking has a hold expiry');
const again = await one(book('gh-ocean-villa', 18, 22, 2, 1, 1, 264760, 'key-booking-a-1'));
ok(again.id === b1.id && Number((await one('select count(*) from public.bookings')).count) === 1, 'same idempotency key returns the same booking');
await throws(book('gh-cliff-suite', 18, 22, 2, 1, 1, 0, 'key-capacity'), /capacity/, 'party bigger than the room is rejected');
await throws(book('gh-ocean-villa', 22, 18, 2, 0, 1, 0, 'key-bad-dates'), /check-out must be after check-in/, 'check-out before check-in is rejected');
await throws(book('gh-ocean-villa', -5, -2, 2, 0, 1, 0, 'key-past'), /past/, 'past check-in is rejected');
await throws(`select * from public.create_booking('grand-horizon', 'gh-ocean-villa', current_date + 18, current_date + 22, 2, 0, 1, 'Guest A', 'call me', '', 0, 'key-phone')`, /phone/, 'invalid phone is rejected');

await db.query(`update public.bookings set status = 'confirmed', payment_status = 'paid'`);
ok((await one(`select status from public.bookings where id = $1`, [b1.id])).status === 'pending_payment', 'direct update by the client changes nothing (no RLS update policy)');
await throws(`insert into public.payments (booking_id, user_id, provider, provider_reference, status, method_label, amount_cents, idempotency_key) values ('${b1.id}', '00000000-0000-0000-0000-0000000000a1', 'sandbox', 'x', 'succeeded', 'x', 1, 'x')`, /row-level security/, 'client cannot insert payments directly');

const declined = await one(`select * from public.record_sandbox_payment($1, 'declined', 'Test card ·· 0002 (sandbox)', 'sbx_1', 'pay-1')`, [b1.id]);
ok(declined.status === 'pending_payment' && declined.payment_status === 'failed', 'declined payment keeps the booking pending');
const paid = await one(`select * from public.record_sandbox_payment($1, 'succeeded', 'Mastercard ·· 4444 (sandbox)', 'sbx_2', 'pay-2')`, [b1.id]);
ok(paid.status === 'confirmed' && paid.payment_status === 'paid' && paid.hold_expires_at === null, 'successful payment confirms the booking');
await db.query(`select * from public.record_sandbox_payment($1, 'succeeded', 'Mastercard ·· 4444 (sandbox)', 'sbx_2', 'pay-2')`, [b1.id]);
await db.query(`select * from public.record_sandbox_payment($1, 'succeeded', 'Mastercard ·· 4444 (sandbox)', 'sbx_3', 'pay-3')`, [b1.id]);
ok(Number((await one(`select count(*) from public.payments where status = 'succeeded'`)).count) === 1, 'repeated payment requests are not recorded twice');

await one(book('gh-family-villa', 30, 32, 2, 0, 2, 401600, 'key-family-2-rooms'));
await throws(book('gh-family-villa', 31, 33, 2, 0, 1, 200800, 'key-family-sold-out'), /unavailable/, 'inventory is enforced across overlapping nights');
ok(Number((await one(book('gh-family-villa', 32, 34, 2, 0, 1, 200800, 'key-family-after'))).total_cents) === 200800, 'check-out day does not block the next check-in');

// Expired hold: frees inventory and refuses payment.
await db.exec('reset role');
await db.query(`update public.bookings set hold_expires_at = now() - interval '1 minute' where idempotency_key = 'key-family-2-rooms'`);
await as('a');
const freed = await one(`select available from public.room_availability(array['gh-family-villa'], current_date + 30, current_date + 32)`);
ok(freed.available === 2, 'an expired hold no longer blocks inventory', `available=${freed.available}`);
const fam = await one(`select id from public.bookings where idempotency_key = 'key-family-2-rooms'`);
await throws(`select * from public.record_sandbox_payment('${fam.id}', 'succeeded', 'x (sandbox)', 'sbx_9', 'pay-9')`, /hold_expired/, 'paying an expired hold is refused');

// Cancellation: confirmed + refundable → cancelled & voided.
const cancelled = await one(`select * from public.cancel_booking($1)`, [b1.id]);
ok(cancelled.status === 'cancelled' && cancelled.payment_status === 'voided', 'cancelling a refundable paid booking voids the sandbox payment');
await throws(`select * from public.cancel_booking('${b1.id}')`, /no longer be changed/, 'a cancelled booking cannot be cancelled again');

// Favorites: unique per user, private.
await db.query(`insert into public.favorites (hotel_id) values ('grand-horizon')`);
await throws(`insert into public.favorites (hotel_id) values ('grand-horizon')`, /duplicate key/, 'duplicate favorite is rejected');

await as('b');
ok(Number((await one('select count(*) from public.bookings')).count) === 0, 'another user cannot read the bookings');
ok(Number((await one('select count(*) from public.favorites')).count) === 0, 'another user cannot read the favorites');
ok(Number((await one('select count(*) from public.payments')).count) === 0, 'another user cannot read the payments');
await throws(`select * from public.cancel_booking('${b1.id}')`, /not_found/, 'another user cannot cancel the booking');
await throws(`insert into public.favorites (user_id, hotel_id) values ('00000000-0000-0000-0000-0000000000a1', 'azure-lagoon')`, /row-level security/, 'cannot add a favorite for someone else');
await db.query(`update public.profiles set full_name = 'Hacked' where email = 'guest.a@test.dev'`);
await db.exec('reset role');
ok((await one(`select full_name from public.profiles where email = 'guest.a@test.dev'`)).full_name === 'Guest A', 'cannot edit another user’s profile');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
