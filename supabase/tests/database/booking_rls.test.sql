-- Run with: supabase test db   (needs the Supabase CLI and Docker; seed.sql is loaded first)
-- Verifies trusted-side pricing, capacity/inventory checks, idempotency,
-- sandbox payment handling and per-user isolation of private data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'guest.a@test.dev', '{"full_name":"Guest A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'guest.b@test.dev', '{"full_name":"Guest B"}');

-- Anonymous visitors can browse the catalog but see no bookings.
set local role anon;
select ok((select count(*) from public.hotels) > 0, 'anon can read hotels');
select is((select count(*)::int from public.bookings), 0, 'anon sees no bookings');

-- Guest A books 4 nights of the Ocean View Pool Villa ($579, 10% tax, $25/night resort fee).
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select throws_like($$
  select public.create_booking('grand-horizon', 'gh-ocean-villa', current_date + 18, current_date + 22, 2, 1, 1,
    'Guest A', '+62 852 3239 6140', '', 1, 'key-price-mismatch')
$$, '%price_changed%', 'a client total that differs from the server price is rejected');

select lives_ok($$
  select public.create_booking('grand-horizon', 'gh-ocean-villa', current_date + 18, current_date + 22, 2, 1, 1,
    'Guest A', '+62 852 3239 6140', '', 264760, 'key-booking-a-1')
$$, 'booking with the server-computed total succeeds');
select is((select total_cents from public.bookings where idempotency_key = 'key-booking-a-1'), 264760::bigint,
  'total = 4 × $579 + 10% tax + 4 × $25 fee = $2,647.60');
select is((select status from public.bookings where idempotency_key = 'key-booking-a-1'), 'pending_payment', 'new booking waits for payment');

select public.create_booking('grand-horizon', 'gh-ocean-villa', current_date + 18, current_date + 22, 2, 1, 1,
  'Guest A', '+62 852 3239 6140', '', 264760, 'key-booking-a-1');
select is((select count(*)::int from public.bookings), 1, 'retrying with the same key does not create a second booking');

select throws_like($$
  select public.create_booking('grand-horizon', 'gh-cliff-suite', current_date + 18, current_date + 22, 2, 1, 1,
    'Guest A', '+62 852 3239 6140', '', 0, 'key-capacity')
$$, '%capacity%', 'a party larger than the room sleeps is rejected');

select throws_like($$
  select public.create_booking('grand-horizon', 'gh-ocean-villa', current_date + 22, current_date + 18, 2, 0, 1,
    'Guest A', '+62 852 3239 6140', '', 0, 'key-bad-dates')
$$, '%check-out must be after check-in%', 'check-out before check-in is rejected');

-- Direct writes to bookings and payments are not allowed.
-- RLS has no update policy, so a direct update silently matches no rows.
update public.bookings set status = 'confirmed', payment_status = 'paid';
select is((select status from public.bookings where idempotency_key = 'key-booking-a-1'), 'pending_payment',
  'clients cannot mark a booking confirmed by updating it directly');

-- Sandbox payment: declined, then succeeded; a repeat is a no-op.
create temp table b as select id from public.bookings where idempotency_key = 'key-booking-a-1';
grant select on b to authenticated;
select is((select payment_status from public.record_sandbox_payment((select id from b), 'declined', 'Test card ·· 0002 (sandbox)', 'sbx_1', 'pay-1')),
  'failed', 'a declined payment leaves the booking pending');
select is((select status from public.record_sandbox_payment((select id from b), 'succeeded', 'Mastercard ·· 4444 (sandbox)', 'sbx_2', 'pay-2')),
  'confirmed', 'a successful payment confirms the booking');
select public.record_sandbox_payment((select id from b), 'succeeded', 'Mastercard ·· 4444 (sandbox)', 'sbx_2', 'pay-2');
select is((select count(*)::int from public.payments where status = 'succeeded'), 1, 'a repeated payment request is not recorded twice');

-- Inventory: the family villa has 2 units; a third overlapping booking is refused.
select public.create_booking('grand-horizon', 'gh-family-villa', current_date + 30, current_date + 32, 2, 0, 2,
  'Guest A', '+62 852 3239 6140', '', 401600, 'key-family-2-rooms');
select throws_like($$
  select public.create_booking('grand-horizon', 'gh-family-villa', current_date + 31, current_date + 33, 2, 0, 1,
    'Guest A', '+62 852 3239 6140', '', 200800, 'key-family-sold-out')
$$, '%unavailable%', 'inventory is enforced across overlapping nights');

-- Guest B cannot see or touch Guest A's data.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.bookings), 0, 'another user cannot read the booking');
select throws_like($$ select public.cancel_booking((select id from b)) $$, '%not_found%', 'another user cannot cancel the booking');

select * from finish();
rollback;
