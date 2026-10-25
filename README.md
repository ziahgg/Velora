# Velora

Velora is a travel and hotel booking mobile app (iOS and Android) built with React Native, Expo, TypeScript and Supabase from the Velora Figma design (*ziahdesign → App Velora*, node 262-4229).

It covers hotel discovery, room selection, reservations and booking management, through to a sandbox payment:

**Home → Hotel Detail → Room Selection → Booking Review → Payment → Booking Confirmation → My Trips**

<table>
<tr>
<td><img src="docs/screens/03-home.png" width="180" alt="Home"></td>
<td><img src="docs/screens/04-hotel-detail.png" width="180" alt="Hotel detail"></td>
<td><img src="docs/screens/05-room-selection.png" width="180" alt="Room selection"></td>
<td><img src="docs/screens/06-review.png" width="180" alt="Booking review"></td>
</tr>
<tr>
<td><img src="docs/screens/08-payment.png" width="180" alt="Payment"></td>
<td><img src="docs/screens/09-payment-declined.png" width="180" alt="Payment declined"></td>
<td><img src="docs/screens/10-confirmed.png" width="180" alt="Booking confirmed"></td>
<td><img src="docs/screens/11-trips-after-restart.png" width="180" alt="My Trips"></td>
</tr>
</table>

<sub>These screenshots come from the Expo web build at 390 × 844, taken by `npm run e2e:web`.</sub>

## Status at a glance

| Area | State |
| --- | --- |
| Hotel discovery: search, suggestions, filters, sorting, destinations, map view | ✅ Working, using the bundled sample catalog |
| Room selection with live availability for the chosen dates | ✅ Working (demo inventory) |
| Booking review, priced and validated on the trusted side | ✅ Working |
| Payment | ⚠️ **Sandbox only.** No real money moves, and no payment provider is connected |
| Confirmation, My Trips, voucher, cancellation | ✅ Working |
| Favorites, profile, settings | ✅ Working |
| Auth: sign up, sign in, sign out, session persistence, change password | ✅ Working in both backends |
| Password-reset email | Supabase backend only; the demo backend can't send email |
| Supabase backend: schema, RLS, functions, seed | ✅ Written, and its SQL is tested on Postgres (PGlite). ❌ Not yet run against a hosted Supabase project |
| Flights and Car rental | 🚧 Labeled "coming soon". There is no inventory, so they are not presented as bookable |
| Native iOS / Android run | ❌ Not run here: this machine has no Xcode or Android SDK. Both native JS bundles compile |

## Requirements

- Node.js 22 or later (developed on 24.16.0) and npm 11
- To run on a device:
  - Expo Go for **SDK 58**, or a development build;
  - Xcode, to use the iOS Simulator;
  - Android Studio, to use an emulator.
- Optional, for the real backend:
  - a Supabase project;
  - the Supabase CLI and Docker, for `npm run test:db`.

## Quick start (demo mode, no backend needed)

```bash
npm install
npm start            # then press i (iOS simulator), a (Android emulator), or scan the QR code with Expo Go
npm run web          # browser preview
```

With no Supabase variables set, the app uses an on-device demo backend that stores data in AsyncStorage. It enforces the same rules as the database:
- the server price must match the shown price;
- room capacity and nightly inventory are checked;
- booking and payment requests are idempotent;
- a payment hold lasts 15 minutes;
- booking status changes follow explicit transitions.

Sign in with the demo account, **`ziah@velora.travel` / `velora2026`** (on the sign-in screen, tap the demo note to fill it in). The account starts with saved stays, one upcoming trip and one past trip. You can also create your own account, which starts empty.

## Supabase setup (production-style backend)

1. Create a Supabase project.
2. Link it and apply the schema and the sample seed:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push                                  # supabase/migrations/20261025000100_init.sql
   psql "$SUPABASE_DB_URL" -f supabase/seed.sql      # or paste seed.sql into the SQL editor
   ```
3. Copy `.env.example` to `.env` and set:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Only the public **anon** key belongs in the app. Never put the service-role key, or any payment-provider secret, in this project.
4. In Supabase → Auth → URL configuration, add `velora://reset-password` (plus your web origin's `/reset-password`, if you use web) as a redirect URL for password-reset emails.
5. Restart `npm start`. The Profile badge changes from "Demo" to "Member", and the demo-account note disappears from sign-in.

`supabase/seed.sql` is generated from `src/data/seed/catalog.json`, so the demo and Supabase catalogs stay identical. After editing the JSON, regenerate it with `npm run seed:sql`.

**Before going to production:**
- set `sandbox_payments_enabled` to `false` in `public.app_settings`;
- connect a real payment provider (see *Payments*).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | `expo lint` |
| `npm test` | Jest: dates, money, pricing, stay validation, search filters and sorting, booking and payment status rules, form validation, and integration tests of the demo backend (booking, idempotency, inventory, holds, payments, cancellation, favorites, user isolation, restart persistence) |
| `npm run test:db:local` | Applies the real migration and seed to **PGlite** (Postgres in WASM, no Docker needed) with a stand-in `auth` schema, then checks pricing, RLS isolation, idempotency, inventory, holds, sandbox payments and cancellation |
| `npm run test:db` | The pgTAP suite in `supabase/tests`; needs the Supabase CLI and Docker |
| `npm run e2e:web` | Drives the full booking flow in headless Chrome against `npm run web -- --port 8092` and saves screenshots to `e2e-screens/` |
| `npm run seed:sql` | Regenerates `supabase/seed.sql` from the catalog JSON |

### Builds

`eas.json` defines three profiles:
- `development`: iOS simulator / Android APK;
- `preview`: internal distribution;
- `production`.

```bash
npx eas build --profile preview --platform ios       # or android
npx expo run:ios                                     # local native build (needs Xcode)
npx expo run:android                                 # local native build (needs Android Studio)
```

No EAS or native build has been run for this delivery.

## Architecture

```
src/app/            Expo Router routes
  _layout.tsx       Fonts, providers and the auth gate (onboarding → sign in → app) via Stack.Protected
  onboarding, sign-in, sign-up, forgot-password, reset-password
  (app)/(tabs)/     Home · Search · Saved · Trips · Profile, plus Results (inside the tabs, so the floating nav stays)
  (app)/hotel/[id]  Hotel detail, and [id]/rooms for room selection
  (app)/booking/    review → payment → declined | confirmed
  (app)/trip/[id]   Voucher and cancellation
  (app)/destination/[id], flights, car, settings/*
src/components/     Design system: Text, Icon (Lucide), Button / IconButton, Pills (Tag, CategoryChip, Rating, Segmented),
                    Fields, Photo, Cards (HotelCard, StayRow, DestinationCard, TripCard, AmountDueCard, PaymentMethodRow …),
                    Feedback (Toast, Sheet, StateHero, Empty/Error states, Skeletons), BottomNav, Brand
src/features/       Larger pieces: search (calendar, dates & guests sheet, filters, schematic map), booking, favorites, home
src/lib/            Pure, tested logic: dates, money, pricing, search, booking rules, validation, formatting
src/data/           DataService interface; Supabase implementation; on-device demo implementation; seed catalog; photos
src/payments/       PaymentAdapter boundary plus the sandbox adapter
src/state/          Session/auth, React Query hooks, persisted search context
src/theme/          Tokens and typography taken from the Figma variables and "Velora/*" text styles
supabase/           Migration, generated seed, config, and pgTAP tests
```

**Data flow.** Screens never call Supabase directly. They use `api: DataService`, selected in `src/data/index.ts`. React Query caches the catalog, profile, favorites, bookings and availability. Favorites update optimistically and roll back on error, with an "Undo" toast. Search criteria (place, dates, party, filters, recent searches) live in a context that is persisted without personal data.

**Pricing** is one function, `quoteStay` in `src/lib/pricing.ts`, mirrored in the SQL `create_booking`:

- room subtotal = nightly rate × nights × rooms;
- taxes = the hotel's tax rate on the subtotal, rounded half-up to the cent;
- fees = resort fee × nights × rooms;
- total = subtotal + taxes + fees.

All money is in integer US cents.

The design's own example checks out: $579 × 4 = $2,316, plus $231.60 tax and $100 fees, gives **$2,647.60**. A unit test and the database test both assert this.

**Booking integrity.** `create_booking` is a security-definer function. It:
- checks the user;
- validates the dates and the party size against room capacity;
- locks the room type and checks per-night inventory (confirmed bookings plus live holds);
- prices the stay itself and rejects the request if the client's displayed total differs;
- de-duplicates requests with an idempotency key;
- creates a `pending_payment` booking that holds the room for 15 minutes.

Payment results are recorded separately (`payment_status`) and confirm the booking. Status transitions are enforced by a trigger.

**Security.**
- RLS is enabled on every table:
  - the catalog is read-only for everyone;
  - profiles, favorites, bookings and payments are visible only to their owner;
  - clients have no insert or update policy on bookings or payments.
- No card data is stored anywhere. Payments keep only the provider, its reference and a display label.
- The app holds only public configuration.

## Payments

`src/payments/adapter.ts` defines the boundary. The sandbox adapter offers test methods; the "Test card · declines" method always declines, so you can see the failure screen.

The sandbox outcome is reported by the client and recorded by `record_sandbox_payment`. **That is not proof of payment**, which is why it is behind a server switch.

A real integration should work like this:
- a server-side function creates the payment (e.g. a Stripe PaymentIntent) for the booking's stored total;
- the app shows the provider's payment sheet;
- the provider's webhook confirms the booking using the service role, on the server.

Card numbers never touch the app or the database.

## Design fidelity

Every screen was built from the Figma frames' measured values:
- the "Velora/*" text styles in Plus Jakarta Sans;
- colors from the Velora variables;
- 20px side margins, 22px section gaps;
- 24, 30 and 32px radii;
- Lucide 24/2 icons.

The main screens were compared side by side with the Figma frames (Home, Hotel Detail, Room Selection, Review, Payment, Confirmed, Payment Failed, My Trips), and the visible differences were fixed. The brand mark and wordmark are the vector paths from the Figma "Brand/*" components. Photos are the Figma file's own (Unsplash) images plus a few more Unsplash photos, all bundled with the app so it works offline.

Intentional differences:
- **Avatar:** initials instead of a stock portrait. The app doesn't collect profile photos.
- **Profile badge:** shows "Demo" or "Member" instead of "Gold"; there is no loyalty programme.
- **Sparkles "AI planner" button:** says the planner is coming soon.
- **Home bell:** opens reminders built from the user's real bookings (payment holds, upcoming check-ins).
- **Destination screen:** no temperature pill, because there is no weather source. Stay counts and "from" prices are computed from the data, not taken from the design's illustrative numbers.
- **Booking confirmation:** doesn't claim an email was sent, because none is.
- **Map view:** a schematic based on hotel coordinates; no map SDK is used.
- **Flights and Car:** clearly labeled coming-soon screens instead of the Figma search and result forms, which would imply bookable inventory.
- **Web build:** there is no status bar, so content starts higher than in the frames. On devices, the safe-area insets add the gap.

## Known limitations

- Hotels, prices, ratings, review counts and inventory are **development sample data**, labeled in the app. There is no live inventory.
- Payments are sandbox only, and refunds aren't real: a refundable cancellation marks the sandbox payment "voided".
- Google and Apple sign-in buttons appear but tell the user they aren't configured.
- Push notifications aren't connected. The notification preference is saved, and reminders appear in the app.
- Only English and USD are supported, with no currency conversion.
- **Not verified:**
  - running on an iOS simulator or Android emulator, or a physical device (only the JS bundles were compiled);
  - the app against a hosted Supabase project;
  - `supabase test db` (pgTAP).

  The same database scenarios pass on PGlite via `npm run test:db:local`.
