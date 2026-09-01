# Miqāt — prayer times

A web app that computes prayer times on the device, from the sun's position, with every
parameter that decides a minute exposed and checkable.

```bash
npm --prefix miqat install
npm --prefix miqat run dev      # http://localhost:5183
npm --prefix miqat run verify   # accuracy regression against official timetables
```

## What the research turned up

**There is no secret prayer-times API.** Athan Pro (Quanticapps) and Athan (IslamicFinder) —
the two big blue-icon apps — both compute times locally from astronomy. Quanticapps' own
support pages give it away: the app "automatically adjusts prayer times according to the ones
used by the largest mosques and Islamic ministries in each country", it works offline, and
when times don't match your mosque the fix they offer is to change the calculation method or
apply a manual correction. That is a local solar calculation with a per-country preset, not a
feed.

So accuracy is not an API-shopping problem. It comes down to four things:

1. **Coordinates.** Prayer times move ~4 minutes per degree of longitude.
2. **Convention.** Which Fajr/Isha angle the local authority uses, plus its own rounding and
   safety offsets.
3. **Asr rule.** Shadow length ×1 (standard) or ×2 (Hanafi) — up to an hour apart.
4. **The last few minutes.** Elevation, and whatever your mosque actually does.

## How this app is built

| Layer | Choice | Why |
| --- | --- | --- |
| Engine | [`adhan`](https://github.com/batoulapps/adhan-js) (Batoul Apps) | High-precision equations from Jean Meeus' *Astronomical Algorithms*. Runs offline, no rate limit, instant. |
| Cross-check | [api.aladhan.com](https://aladhan.com/prayer-times-api) | Free, no key, CORS-open. A second independent implementation to diff against. |
| City search | [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | Free, no key, returns IANA timezone **and** elevation. |
| Reverse geocode | [BigDataCloud](https://www.bigdatacloud.com/) client endpoint | Free, no key, names a GPS fix. |

Times are never fetched to be displayed — the network is only ever used to find *where* you
are and to verify the maths.

### Accuracy features

- 23 published conventions, auto-selected from the country of your location.
- Asr madhab, high-latitude rule, and Moonsighting shafaq.
- **Elevation correction.** Horizon dip of `0.0347·√h` degrees, converted to a time shift
  through the sunrise hour angle, applied to sunrise and Maghrib before rounding. At Al Ain's
  275 m that is 2.6 minutes.
- **Per-prayer manual correction.** The only honest way to match one specific mosque.
- **Independent check** in-app: same parameters sent to AlAdhan, diffed minute by minute.

### What `npm run verify` found

The UAE preset that both libraries ship is wrong, in opposite directions. Fitted against the
official Awqaf timetable for Dubai:

| Preset | Asr | Sunrise |
| --- | --- | --- |
| `adhan` Dubai (`asr +3`) | wrong all 31 days, up to 3 min late | correct |
| AlAdhan method 16 (`sunrise +0`) | correct | wrong all 31 days, up to 4 min late |
| **This app** (`sunrise −3, dhuhr +3, asr +1, maghrib +3`) | 29/31 exact | 18/31 exact |

The regression then widened to all seven emirates plus Al Ain, eight months of 2026, from an
independent publisher of the same official table — **11,634 published times**:

```
Dubai            241 days · worst 1 min · 100.0% within a minute
Abu Dhabi        243 days · worst 2 min ·  99.9% within a minute
Sharjah          242 days · worst 2 min ·  99.9% within a minute
Ajman            243 days · worst 2 min ·  99.9% within a minute
Fujairah         243 days · worst 3 min ·  99.9% within a minute
Ras Al Khaimah   242 days · worst 2 min ·  99.4% within a minute
Umm Al Quwain    241 days · worst 2 min ·  98.3% within a minute
Al Ain           241 days · worst 1 min · 100.0% within a minute
                                           99.7% overall
```

### The terrain correction, and why Al Ain caught it

Al Ain used to sit at 88% while every other city was above 99%. It is the only station Awqaf
publishes that has real height — 275 m against 3–15 m everywhere else — and it was the only one
where sunrise ran late *and* Maghrib ran early, i.e. the computed day was shorter than the
published one. Nothing else does that: elevation is the only input that moves sunrise and sunset
without touching Fajr, Dhuhr, Asr or Isha.

The obvious fix was wrong. Feeding the true 275 m made it *worse* (85.8%), because standing high
on a plateau is not standing on a tower — the land around you is high too, so the horizon barely
drops. Awqaf's table behaves like roughly 75 m. The convention therefore carries a
`horizonFactor` of 0.27, applied through the same dip-to-hour-angle maths so it still varies
correctly with date and latitude. Al Ain went to 100%; the sea-level cities moved by a fifth of a
minute, which rounds away.

Two lessons are baked into `npm run verify` as a result: the reference stations carry their
elevation so this path is actually under test, and the fixture builder drops single-day spikes —
a value several minutes off both its neighbours, which the sun cannot do — because three of those
typos in the published feed were masquerading as engine error.

Dubai is exact because that is the city Awqaf computes for. Everywhere else the residual is
Awqaf's own reference point — one spot per emirate — against the app's use of your actual
coordinates, plus a handful of days the feed plainly mistypes.

Three things worth knowing, all found by running this:

- **Khaleej Times' per-emirate tables are an approximation.** Their Abu Dhabi table is the Dubai
  table plus a flat 4 minutes; their Umm Al Quwain table *is* the Dubai table. Gulf News carries
  the real per-city Awqaf figures. Both are kept in `reference/`, the second as a cross-check.
- **Gulf News' feed silently invents data past the published calendar.** Beyond the current
  month it falls back to a generic fixed-90-minute-Isha calculation. The tell is an
  Isha-after-Maghrib gap that never varies; the fixture builder rejects any month showing it.
- **Elevation is off by default.** Published timetables are computed at sea level, so applying
  the correction is truer to your horizon but a minute or two off the time your mosque calls.

## Iqama, notifications, Qibla

- **Adhan / Iqama toggle** at the top of the board switches every time, and the countdown with
  it. Defaults are Awqaf's standard — 20 minutes for Fajr, Dhuhr, Asr and Isha, 5 for Maghrib,
  none for sunrise — and each is adjustable. Friday swaps Dhuhr for Jumuʿah at a fixed clock time.
- **Notifications** fire while the page is open. Waking a locked phone needs Web Push behind a
  service worker, and on iOS the app installed to the home screen first; the UI says so rather
  than implying an alarm clock it cannot be.
- **Qibla** is a great-circle bearing to the Kaaba, checked against an independent implementation
  to three decimals. The dial reports whether the phone's compass is referenced to true or
  magnetic north, and flags when the sensor says it needs calibrating.

## The sky

The background is the real sun, in the real place it is right now — `lib/sun.ts` computes its
altitude and hour angle from the location, `lib/sky.ts` turns altitude into a colour, and the
page tints continuously as it climbs to Dhuhr, sinks through Asr, burns at Maghrib and sets by
Isha. The UI flips to dark ink on a light sky once the sun is a few degrees up.

No WebGL, no canvas, no library, no per-frame work: the whole scene is layered radial gradients
on composited elements, the position updates once every thirty seconds, and CSS transitions carry
it between. The roundness is an off-centre highlight plus a darkened lower rim, which is what
actually reads as a sphere at this size. It is the only heavy-looking thing in the app and it
costs about 6 kB of CSS.

## The shipped timetable

Awqaf already decides the angle, the rounding, the terrain and every seasonal
adjustment. Where they publish a table, the app carries it and shows it — no calculation
involved, so it matches the mosque exactly rather than approximately.

```bash
npm --prefix miqat run build:timetable   # fetch, validate, write src/data
```

Nothing enters that file untested. Each day must run forwards, must not be the feed's
fixed-90-minute-Isha filler, must sit within eight minutes of our own astronomy, and must not
jump away from its neighbours. A day that fails any check is left out and the app calculates
it instead — a gap is recoverable, a wrong prayer time is not.

Calculation remains the fallback: for towns with no published table, dates past the end of
it, and the rest of the world. The app says which one you are looking at.

Coverage is Jan–Sep 2026 for eight cities, 2,157 days. Awqaf has not published the rest of
the year yet; the daily audit says when they do.

## The standing accuracy watch

Awqaf publishes no API and issues no keys — their site and Dubai's IACAD open-data page both
refuse scripts. So `/api/audit` reads the timetable Gulf News republishes, recomputes the entire
current month for all eight cities Awqaf lists separately, and diffs the two. A Vercel cron runs
it daily; the result is written to `miqat_accuracy_checks` and shown in the app under Accuracy.

The feed is undocumented and lies in two known ways, both guarded in `lib/awqafFeed.ts`: past the
published calendar it silently serves a generic fixed-90-minute-Isha calculation instead of
nothing (the tell is an Isha-after-Maghrib gap that never varies), and individual days carry
typos (a value several minutes off both neighbours, which the sun cannot do). Either would
otherwise be reported as drift that isn't there. A run with no usable stations fails rather than
passing quietly.

```
GET /api/audit                          → the last verdict, public
GET /api/audit  (with the cron secret)  → run it now, record, return
```

Last run: 1,482 comparisons, 100% within a minute, worst gap 1 minute.

## Analytics, on your own machine

```bash
npm --prefix miqat run analytics    # http://127.0.0.1:7823
```

No Miqāt account and nothing hosted. The server binds to the loopback address only, credentials
live in `~/.miqat/config.json` at mode 0600, and the secret never reaches the browser — the page
asks the local process, which asks the database. Shows visitors, visits, places, countries,
devices, a per-day chart, and a world map of the precise fixes people have opted into sharing.

## Usage reporting

`miqat_` tables in the shared STERK Supabase project, alongside the `shop_` ones.

Two tiers, separated on purpose. Every visit records a random id, a visit count, and the town the
app already resolved. Precise coordinates are stored **only** after an unticked-by-default opt-in
under Settings → Privacy — and that is enforced in the database function, not just the UI, so the
switch cannot be bypassed from the client. Consent grants and withdrawals are logged with the
policy version, and `miqat_forget` deletes a visitor and everything cascading from them.

Nothing writes to the database from the browser. The page posts to this app's own `/api/track`,
which holds the key and a shared secret server-side, hashes the caller's IP for rate limiting and
validates every field; the database function ignores anything arriving without that secret. So
the published bundle contains no database credential at all, and a request forged against
Supabase directly writes nothing.

RLS is on with no policies, so even the anon key cannot read or write the tables; everything goes
through one definer function. No visitor can ever read another's location. Read your own data
from the `miqat_dashboard` view in the Supabase SQL editor.

## Layout

```
src/lib/methods.ts   calculation conventions + country→method map
src/lib/prayer.ts    engine wrapper, elevation correction, next-prayer logic
src/lib/time.ts      timezone-correct formatting (never uses the device zone by accident)
src/lib/geo.ts       GPS, city search, reverse geocode, elevation
src/lib/verify.ts    in-app cross-check against AlAdhan
src/lib/analytics.ts usage reporting, with the consent split
src/lib/uaePlaces.ts tap-to-pick list of UAE towns
scripts/verify.ts    regression against the official timetables in reference/
```
