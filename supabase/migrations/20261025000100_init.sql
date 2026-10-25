-- Velora — initial schema.
--
-- Access model
--   * Catalog (destinations, amenities, hotels, hotel_images, hotel_amenities,
--     room_types) is public and read-only for clients.
--   * profiles, favorites, bookings and payments are private to their owner (RLS).
--   * Clients can never insert or update bookings/payments directly. All writes go
--     through the security-definer functions below, which price the stay
--     themselves, check capacity and inventory, and enforce status transitions.
--
-- Money is stored as integer US cents. Stay dates are DATE (calendar days).

create extension if not exists pgcrypto;

-- ───────────────────────────── Catalog ─────────────────────────────

create table public.destinations (
  id text primary key,
  name text not null,
  country text not null,
  blurb text not null default '',
  photo text not null,
  areas text[] not null default '{}',
  lat double precision not null,
  lng double precision not null,
  sort_order int not null default 0
);

create table public.amenities (
  id text primary key,
  label text not null,
  icon text not null
);

create table public.hotels (
  id text primary key,
  destination_id text not null references public.destinations (id),
  name text not null,
  area text not null,
  address text not null,
  location_note text not null default '',
  description text not null default '',
  property_type text not null check (property_type in ('villa', 'resort', 'hotel', 'apartment')),
  rating numeric(2, 1) not null check (rating between 0 and 5),
  review_count int not null default 0 check (review_count >= 0),
  highlights text[] not null default '{}',
  check_in_time text not null default '14:00',
  check_out_time text not null default '12:00',
  resort_fee_per_night_cents int not null default 0 check (resort_fee_per_night_cents >= 0),
  tax_rate_bps int not null default 1000 check (tax_rate_bps between 0 and 5000),
  lat double precision not null,
  lng double precision not null,
  is_sample boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0
);
create index hotels_destination_idx on public.hotels (destination_id) where active;

create table public.hotel_images (
  hotel_id text not null references public.hotels (id) on delete cascade,
  position int not null,
  photo text not null,
  primary key (hotel_id, position)
);

create table public.hotel_amenities (
  hotel_id text not null references public.hotels (id) on delete cascade,
  amenity_id text not null references public.amenities (id),
  primary key (hotel_id, amenity_id)
);

create table public.room_types (
  id text primary key,
  hotel_id text not null references public.hotels (id) on delete cascade,
  name text not null,
  category text not null check (category in ('room', 'suite', 'villa')),
  photo text not null,
  size_m2 int not null check (size_m2 > 0),
  bed text not null,
  max_guests int not null check (max_guests between 1 and 12),
  price_per_night_cents int not null check (price_per_night_cents > 0),
  free_cancel_days int check (free_cancel_days is null or free_cancel_days >= 0),
  breakfast_included boolean not null default false,
  features text[] not null default '{}',
  inventory int not null check (inventory >= 0),
  badge text,
  active boolean not null default true,
  sort_order int not null default 0
);
create index room_types_hotel_idx on public.room_types (hotel_id) where active;

-- ───────────────────────────── Users ─────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 24),
  notifications_enabled boolean not null default true,
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hotel_id text not null references public.hotels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hotel_id)
);

-- ───────────────────────────── Bookings & payments ─────────────────────────────

create sequence public.booking_reference_seq start 48217;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  hotel_id text not null references public.hotels (id),
  room_type_id text not null references public.room_types (id),
  check_in date not null,
  check_out date not null,
  adults int not null check (adults between 1 and 10),
  children int not null default 0 check (children between 0 and 6),
  rooms int not null default 1 check (rooms between 1 and 4),
  guest_name text not null check (char_length(guest_name) between 2 and 80),
  guest_phone text not null,
  guest_email text not null,
  special_requests text not null default '' check (char_length(special_requests) <= 300),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'confirmed', 'cancelled', 'expired')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'failed', 'voided')),
  -- Price snapshot, computed by create_booking (never taken from the client).
  nights int not null check (nights between 1 and 30),
  nightly_rate_cents int not null check (nightly_rate_cents > 0),
  subtotal_cents bigint not null,
  tax_rate_bps int not null,
  tax_cents bigint not null,
  resort_fee_per_night_cents int not null,
  fees_cents bigint not null,
  total_cents bigint not null check (total_cents = subtotal_cents + tax_cents + fees_cents),
  free_cancel_until date,
  hold_expires_at timestamptz,
  paid_with text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  check (check_out > check_in),
  unique (user_id, idempotency_key)
);
create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_room_dates_idx on public.bookings (room_type_id, check_in, check_out) where status in ('pending_payment', 'confirmed');

-- No card data is ever stored: only the provider, its reference and a display label.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('sandbox')),
  provider_reference text not null,
  status text not null check (status in ('succeeded', 'declined')),
  method_label text not null check (char_length(method_label) <= 60),
  amount_cents bigint not null check (amount_cents > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, idempotency_key)
);

-- Server-side switches. No client policy: only the functions below read it.
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
-- Sandbox payments let the client report a test outcome. Turn this OFF in
-- production and confirm bookings from a payment-provider webhook instead.
insert into public.app_settings (key, value) values ('sandbox_payments_enabled', 'true');

-- ───────────────────────────── Triggers ─────────────────────────────

-- Profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Profile edits may not change the id, email or currency.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.email <> old.email or new.currency <> old.currency then
    raise exception 'forbidden: these profile fields can''t be changed here' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Explicit status transitions (mirrors src/lib/booking.ts).
create or replace function public.bookings_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> old.status and not (
    (old.status = 'pending_payment' and new.status in ('confirmed', 'expired', 'cancelled')) or
    (old.status = 'confirmed' and new.status = 'cancelled')
  ) then
    raise exception 'validation: booking can''t move from % to %', old.status, new.status using errcode = 'P0001';
  end if;
  if new.payment_status <> old.payment_status and not (
    (old.payment_status in ('unpaid', 'failed') and new.payment_status in ('paid', 'failed')) or
    (old.payment_status = 'paid' and new.payment_status = 'voided')
  ) then
    raise exception 'validation: payment can''t move from % to %', old.payment_status, new.payment_status using errcode = 'P0001';
  end if;
  if new.total_cents <> old.total_cents or new.check_in <> old.check_in or new.check_out <> old.check_out
     or new.room_type_id <> old.room_type_id or new.rooms <> old.rooms then
    raise exception 'validation: a booking''s stay and price can''t be edited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bookings_status_guard before update on public.bookings
  for each row execute function public.bookings_status_guard();

-- ───────────────────────────── Functions ─────────────────────────────

-- Units of a room type free on every night of [p_check_in, p_check_out).
-- Confirmed bookings and live payment holds count against inventory.
create or replace function public.room_units_available(p_room_type_id text, p_check_in date, p_check_out date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, rt.inventory - coalesce((
    select max(used) from (
      select sum(b.rooms) as used
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') as night(d)
      join public.bookings b
        on b.room_type_id = p_room_type_id
       and b.check_in <= night.d::date and night.d::date < b.check_out
       and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.hold_expires_at > now()))
      group by night.d
    ) per_night
  ), 0))::int
  from public.room_types rt
  where rt.id = p_room_type_id;
$$;

-- Availability for several room types at once (public: reveals counts only).
create or replace function public.room_availability(p_room_type_ids text[], p_check_in date, p_check_out date)
returns table (room_type_id text, available int)
language sql
stable
security definer
set search_path = public
as $$
  select id, public.room_units_available(id, p_check_in, p_check_out)
  from public.room_types
  where id = any (p_room_type_ids) and active
    and p_check_out > p_check_in and p_check_out - p_check_in <= 30;
$$;

-- Prices the stay on the trusted side, checks capacity and inventory, and
-- creates a pending booking that holds the room for 15 minutes.
create or replace function public.create_booking(
  p_hotel_id text,
  p_room_type_id text,
  p_check_in date,
  p_check_out date,
  p_adults int,
  p_children int,
  p_rooms int,
  p_guest_name text,
  p_guest_phone text,
  p_special_requests text,
  p_expected_total_cents bigint,
  p_idempotency_key text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.bookings;
  v_hotel public.hotels;
  v_room public.room_types;
  v_nights int;
  v_subtotal bigint;
  v_tax bigint;
  v_fees bigint;
  v_total bigint;
  v_email text;
  v_digits int;
  v_row public.bookings;
begin
  if v_user is null then
    raise exception 'auth: sign in to book' using errcode = 'P0001';
  end if;
  if coalesce(char_length(p_idempotency_key), 0) not between 8 and 100 then
    raise exception 'validation: missing request key' using errcode = 'P0001';
  end if;

  -- A retried request returns the booking it already created.
  select * into v_existing from public.bookings where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_hotel from public.hotels where id = p_hotel_id and active;
  -- Lock the room type so concurrent bookings check inventory one at a time.
  select * into v_room from public.room_types where id = p_room_type_id and hotel_id = p_hotel_id and active for update;
  if v_hotel.id is null or v_room.id is null then
    raise exception 'not_found: this room is no longer available' using errcode = 'P0001';
  end if;

  v_nights := p_check_out - p_check_in;
  -- current_date is UTC; allow one day of slack for guests ahead of UTC.
  if p_check_in < current_date - 1 then
    raise exception 'validation: check-in can''t be in the past' using errcode = 'P0001';
  end if;
  if p_check_in > current_date + 365 then
    raise exception 'validation: bookings open up to a year ahead' using errcode = 'P0001';
  end if;
  if v_nights < 1 then
    raise exception 'validation: check-out must be after check-in' using errcode = 'P0001';
  end if;
  if v_nights > 30 then
    raise exception 'validation: stays can be up to 30 nights' using errcode = 'P0001';
  end if;
  if p_adults not between 1 and 10 or p_children not between 0 and 6 or p_rooms not between 1 and 4 or p_rooms > p_adults then
    raise exception 'validation: check the number of guests and rooms' using errcode = 'P0001';
  end if;
  if p_adults + p_children > v_room.max_guests * p_rooms then
    raise exception 'capacity: % sleeps up to % guests per room', v_room.name, v_room.max_guests using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_guest_name, ''))) not between 2 and 80 then
    raise exception 'validation: enter the guest''s full name' using errcode = 'P0001';
  end if;
  v_digits := char_length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g'));
  if v_digits not between 7 and 15 or p_guest_phone !~ '^\+?[0-9 ()-]+$' then
    raise exception 'validation: enter a valid phone number' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_special_requests, '')) > 300 then
    raise exception 'validation: keep requests under 300 characters' using errcode = 'P0001';
  end if;

  if public.room_units_available(p_room_type_id, p_check_in, p_check_out) < p_rooms then
    raise exception 'unavailable: this room just sold out for your dates' using errcode = 'P0001';
  end if;

  -- Same formula as src/lib/pricing.ts quoteStay().
  v_subtotal := v_room.price_per_night_cents::bigint * v_nights * p_rooms;
  v_tax := floor((v_subtotal * v_hotel.tax_rate_bps + 5000) / 10000.0);
  v_fees := v_hotel.resort_fee_per_night_cents::bigint * v_nights * p_rooms;
  v_total := v_subtotal + v_tax + v_fees;
  if v_total <> p_expected_total_cents then
    raise exception 'price_changed: the price for this stay has changed' using errcode = 'P0001';
  end if;

  select email into v_email from public.profiles where id = v_user;

  insert into public.bookings (
    reference, user_id, hotel_id, room_type_id, check_in, check_out, adults, children, rooms,
    guest_name, guest_phone, guest_email, special_requests,
    nights, nightly_rate_cents, subtotal_cents, tax_rate_bps, tax_cents, resort_fee_per_night_cents, fees_cents, total_cents,
    free_cancel_until, hold_expires_at, idempotency_key
  ) values (
    'VLR-' || lpad(nextval('public.booking_reference_seq')::text, 5, '0'), v_user, p_hotel_id, p_room_type_id,
    p_check_in, p_check_out, p_adults, p_children, p_rooms,
    trim(p_guest_name), trim(p_guest_phone), coalesce(v_email, ''), trim(coalesce(p_special_requests, '')),
    v_nights, v_room.price_per_night_cents, v_subtotal, v_hotel.tax_rate_bps, v_tax, v_hotel.resort_fee_per_night_cents, v_fees, v_total,
    case when v_room.free_cancel_days is null then null else p_check_in - v_room.free_cancel_days end,
    now() + interval '15 minutes', p_idempotency_key
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- SANDBOX ONLY. Records a test payment outcome reported by the app's sandbox
-- adapter. A client-reported outcome is not proof of payment, so this is
-- disabled by app_settings.sandbox_payments_enabled = false in production,
-- where a provider webhook (server-side, service role) confirms bookings.
create or replace function public.record_sandbox_payment(
  p_booking_id uuid,
  p_outcome text,
  p_method_label text,
  p_provider_reference text,
  p_idempotency_key text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_enabled boolean;
  v_b public.bookings;
begin
  if v_user is null then
    raise exception 'auth: sign in to pay' using errcode = 'P0001';
  end if;
  select (value)::boolean into v_enabled from public.app_settings where key = 'sandbox_payments_enabled';
  if not coalesce(v_enabled, false) then
    raise exception 'not_supported: sandbox payments are disabled on this server' using errcode = 'P0001';
  end if;
  if p_outcome not in ('succeeded', 'declined') then
    raise exception 'validation: unknown payment outcome' using errcode = 'P0001';
  end if;

  select * into v_b from public.bookings where id = p_booking_id and user_id = v_user for update;
  if not found then
    raise exception 'not_found: we couldn''t find this booking' using errcode = 'P0001';
  end if;

  -- Retries and double taps return the current state without a second payment.
  if exists (select 1 from public.payments where booking_id = p_booking_id and idempotency_key = p_idempotency_key)
     or (v_b.status = 'confirmed' and v_b.payment_status = 'paid') then
    return v_b;
  end if;

  -- An ended hold no longer counts against inventory (see room_units_available);
  -- the app shows it as expired.
  if v_b.status = 'pending_payment' and v_b.hold_expires_at <= now() then
    raise exception 'hold_expired: your hold on this room has ended, so no payment was taken' using errcode = 'P0001';
  end if;
  if v_b.status <> 'pending_payment' then
    raise exception 'validation: this booking can''t be paid any more' using errcode = 'P0001';
  end if;

  insert into public.payments (booking_id, user_id, provider, provider_reference, status, method_label, amount_cents, idempotency_key)
  values (p_booking_id, v_user, 'sandbox', left(p_provider_reference, 64), p_outcome, left(p_method_label, 60), v_b.total_cents, p_idempotency_key);

  if p_outcome = 'succeeded' then
    update public.bookings
       set status = 'confirmed', payment_status = 'paid', confirmed_at = now(), hold_expires_at = null, paid_with = left(p_method_label, 60)
     where id = p_booking_id
    returning * into v_b;
  else
    update public.bookings set payment_status = 'failed' where id = p_booking_id returning * into v_b;
  end if;
  return v_b;
end;
$$;

-- Cancels a pending hold or a confirmed stay that hasn't started.
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_b public.bookings;
  v_refundable boolean;
begin
  select * into v_b from public.bookings where id = p_booking_id and user_id = v_user for update;
  if not found then
    raise exception 'not_found: we couldn''t find this booking' using errcode = 'P0001';
  end if;
  if v_b.status = 'pending_payment' then
    update public.bookings set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
     where id = p_booking_id returning * into v_b;
    return v_b;
  end if;
  if v_b.status <> 'confirmed' then
    raise exception 'validation: this booking can no longer be changed' using errcode = 'P0001';
  end if;
  if v_b.check_in <= current_date then
    raise exception 'validation: stays that have started can''t be cancelled in the app' using errcode = 'P0001';
  end if;
  v_refundable := v_b.free_cancel_until is not null and current_date <= v_b.free_cancel_until;
  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         -- Sandbox: refundable paid bookings are voided; no real money moved.
         payment_status = case when v_b.payment_status = 'paid' and v_refundable then 'voided' else v_b.payment_status end
   where id = p_booking_id
  returning * into v_b;
  return v_b;
end;
$$;

-- ───────────────────────────── Row Level Security ─────────────────────────────

alter table public.destinations enable row level security;
alter table public.amenities enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_images enable row level security;
alter table public.hotel_amenities enable row level security;
alter table public.room_types enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

-- Public catalog: read-only for everyone, no client write policies.
create policy destinations_read on public.destinations for select to anon, authenticated using (true);
create policy amenities_read on public.amenities for select to anon, authenticated using (true);
create policy hotels_read on public.hotels for select to anon, authenticated using (active);
create policy hotel_images_read on public.hotel_images for select to anon, authenticated using (true);
create policy hotel_amenities_read on public.hotel_amenities for select to anon, authenticated using (true);
create policy room_types_read on public.room_types for select to anon, authenticated using (active);

-- Profiles: own row only. Inserted by handle_new_user.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Favorites: own rows only; the primary key prevents duplicates.
create policy favorites_select_own on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert_own on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_delete_own on public.favorites for delete to authenticated using (user_id = auth.uid());

-- Bookings and payments: read own rows; writes only through the functions above.
create policy bookings_select_own on public.bookings for select to authenticated using (user_id = auth.uid());
create policy payments_select_own on public.payments for select to authenticated using (user_id = auth.uid());

-- Function access.
revoke all on function public.room_units_available(text, date, date) from public;
revoke all on function public.create_booking(text, text, date, date, int, int, int, text, text, text, bigint, text) from public, anon;
revoke all on function public.record_sandbox_payment(uuid, text, text, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.room_availability(text[], date, date) to anon, authenticated;
grant execute on function public.create_booking(text, text, date, date, int, int, int, text, text, text, bigint, text) to authenticated;
grant execute on function public.record_sandbox_payment(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
