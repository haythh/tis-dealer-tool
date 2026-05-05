# Vehicle Fitment Integrity Audit

## Integrity Summary

Fitment integrity had three dangerous failure modes: ambiguous truck series were allowed to resolve too broadly, vehicle lookup used `LIKE` model matching after parsing, and no-year series queries like `RAM 1500` could be mistaken for wheel/SKU model filters. That made it possible for 1500/2500/3500 trucks to share fitment rows, for unrelated/nearby model names to leak into results, or for valid no-year fitment searches to return no results. Critical paths now prefer clarification/no result over guess-fit, exact-match parsed vehicle models, keep passenger vehicles limited to TIS Motorsports, and allow known no-year series searches to return compatible era bolt patterns.

## Findings by Severity

### Critical

1. **Broad model matching could cross-match vehicle series/models**
   - **Where:** `src/app/api/search/route.ts`, `src/lib/sms-demo.ts`
   - **What was wrong:** Vehicle lookup used `LOWER(model) LIKE LOWER(?)` for parsed vehicle models. For series vehicles and short model names, that can pull multiple seed rows.
   - **Why it matters:** A 1500 truck can be offered HD 8-lug wheels, or one vehicle can inherit another vehicle's bolt pattern.
   - **Fix:** Parser aliases now canonicalize Silverado/Sierra/RAM series before DB lookup, ambiguous series prompts block results, and DB matching now uses exact model matching for parsed vehicle models.

2. **Ambiguous Silverado/Sierra/RAM queries could guess a series**
   - **Where:** homepage parser and SMS parser/state flow
   - **What was wrong:** RAM defaulted to 1500 in SMS/homepage-style parsing, and Silverado/Sierra without a series could proceed into broad model matching.
   - **Why it matters:** 1500/2500/3500 have different bolt patterns; guessing is unsafe.
   - **Fix:** Silverado/Sierra/RAM without 1500/2500/3500 now return clarification and no wheels, including `Chrome wheels for Chevy Silverado` across homepage API, SMS demo, and Twilio SMS.

3. **No-year RAM 1500 was parsed as a wheel model/SKU filter**
   - **Where:** `src/app/api/search/route.ts`
   - **What was wrong:** The fallback parser extracted any 3-4 digit token as a wheel model, so `20" wheels for RAM 1500` applied `model LIKE '%1500%'` after finding RAM 1500 fitment.
   - **Why it matters:** Dealers expect no-year `RAM 1500` to show compatible 1500 options; instead the homepage API returned no wheels while SMS already found cards.
   - **Fix:** Truck series tokens `1500`, `2500`, and `3500` are no longer treated as wheel model filters. No-year `RAM 1500` now matches known 5- and 6-lug RAM 1500 eras and returns compatible non-8-lug cards.

### High

1. **Parser and DB matching were coupled too loosely**
   - **Where:** `parseQueryFallback`, Gemini result sanitation, SMS `extractVehicle`, `findVehicleFitment`
   - **What was wrong:** If Gemini or SMS parsed `Chevrolet 1500` or `Silverado` inconsistently, the DB layer had to compensate with broad matching.
   - **Why it matters:** One parser miss could become bad fitment.
   - **Fix:** Added shared canonicalization pattern in both homepage and SMS paths for Chevy/GMC/RAM series.

2. **Regression coverage was missing for vehicle fitment invariants**
   - **Where:** no prior repeatable smoke for vehicle fitment path
   - **What was wrong:** The exact user-reported regressions were not encoded as checks.
   - **Why it matters:** Parser tweaks can silently reintroduce unsafe results.
   - **Fix:** Added `scripts/smoke-fitment.mjs` covering homepage API and direct SMS logic for required scenarios, including BMW iX not resolving as Ford/Ranger.

### Medium

1. **Bolt-pattern wheel filtering intentionally matches dual-pattern wheels by substring**
   - **Where:** homepage `wheelQuery`, SMS `searchCards`
   - **Current behavior:** A vehicle with `6x139.7` can return dual-pattern wheels such as `6X135 / 6X5.50` because one side is equivalent to `6x139.7` / `6x5.50`.
   - **Risk:** This is acceptable for dual-drilled wheels, but the current string matching is brittle and should eventually be tokenized into normalized wheel-pattern rows.

2. **Passenger/truck segment depends on seed table completeness**
   - **Where:** `scripts/import-data.mjs`, `vehicleSegmentFromRows`, SMS fitment segment logic
   - **Current behavior:** Passenger vehicles are explicitly marked and restricted to `TIS Motorsports`.
   - **Risk:** New passenger seed rows must be added to `PASSENGER_VEHICLES`; otherwise they will behave as truck searches.

### Low

1. **Homepage and SMS duplicate parser/canonicalization rules**
   - **Where:** `src/app/api/search/route.ts`, `src/lib/sms-demo.ts`
   - **Risk:** Fixes can drift between channels.
   - **Current mitigation:** BMW iX now has explicit BMW-context canonicalization (`bmw ix`, `bmw i-x`, and clear `iX` token) before fitment lookup.
   - **Recommendation:** Move canonical vehicle alias/clarification/exact-match helpers into one shared module.

## Pattern Notes

- Vehicle fitment should be a strict lookup problem, not fuzzy catalog search.
- Ambiguous model families need clarification before bolt-pattern matching.
- Parser aliases should canonicalize to seed-table names before SQL.
- Unknown/unsupported vehicles should produce no confirmed wheel results.
- Passenger fitment must be treated as a separate catalog segment with explicit brand restrictions.

## Recommended Fix Order

1. **Done:** Block ambiguous Silverado/Sierra/RAM series queries.
2. **Done:** Canonicalize Chevy/GMC/RAM series aliases in homepage + SMS.
3. **Done:** Replace broad vehicle model `LIKE` matching with exact matching for parsed vehicle models.
4. **Done:** Add fitment smoke coverage for homepage API + SMS logic.
5. **Done:** Extend smoke coverage to `/api/sms-demo` and `/api/twilio/sms` for no-year RAM 1500 and ambiguous Silverado/RAM clarifications.
6. **Next:** Extract shared vehicle parser/canonicalization helpers so homepage and SMS cannot drift.
7. **Next:** Normalize wheel bolt patterns into queryable tokens instead of substring matching against display strings.
8. **Monitor:** Every new seed vehicle row should be reviewed for segment (`truck`/`passenger`) and ambiguity risk.

## Actual Test Matrix

Ran after fixes with `FITMENT_BASE_URL=http://localhost:4466 node scripts/smoke-fitment.mjs`.

| Query | Homepage API result | SMS result | Integrity check |
|---|---:|---:|---|
| `2022 Chevy 1500 20 black` | 100 exact | 10 preview cards | Parsed `Chevrolet Silverado 1500`; matched `6x139.7`; no 8-lug wheels. |
| `2022 Chevy Silverado 1500 20 black` | 100 exact | 10 preview cards | Parsed `Silverado 1500`; matched `6x139.7`; no 8-lug wheels. |
| `2022 Silverado 1500 20 black` | 100 exact | 10 preview cards | Parsed `Silverado 1500`; matched `6x139.7`; no 8-lug wheels. |
| `2022 Silverado 2500 20 black` | 71 exact | 10 preview cards | Parsed `Silverado 2500`; matched `8x180`. |
| `2022 Silverado` | 0 | 0 | Clarifies `1500, 2500, or 3500`; no guess-fit wheels. |
| `Chrome wheels for Chevy Silverado` | 0 | 0 | Clarifies `Which Silverado: 1500, 2500, or 3500?`; no silent no-result or guess-fit. Twilio returns the same clarification as TwiML. |
| `20" wheels for RAM 1500` | 100 exact | 10 preview cards | Parsed no-year `RAM 1500`; `1500` is not treated as a wheel model; returns compatible 5-/6-lug RAM 1500 options, no 8-lug cards. Twilio returns result TwiML. |
| `RAM` | 0 | 0 | Clarifies `Which RAM model: 1500, 2500, or 3500?`; no guess-fit wheels. Twilio returns the same clarification as TwiML. |
| `Jeep Wrangler` | 100 exact | 10 preview cards | Parsed `Jeep Wrangler`; matched `5x127`; no Ranger parse/notice. |
| `show wheels for Jeep Wrangler` | 100 exact | 10 preview cards | Parsed `Jeep Wrangler`; matched `5x127`; no Ranger parse/notice. |
| `show 20 black wheels for Jeep Wrangler` | 66 exact | 10 preview cards | Parsed `Jeep Wrangler`; matched `5x127`; no Ranger parse/notice. |
| `Jeep Gladiator` | 100 exact | 10 preview cards | Parsed `Jeep Gladiator`; matched `5x127`. |
| `Ford Ranger` | 100 exact | 10 preview cards | Parsed `Ford Ranger`; matched `6x139.7`. |
| `2022 Ford F150` | 100 exact | 10 preview cards | Parsed `Ford F-150`; matched `6x135`. |
| `2022 Honda Accord 20 black` | 4 exact | 4 preview cards | Passenger result; only `TIS Motorsports`. |
| `2021 Toyota Camry 20` | 9 exact | 9 preview cards | Passenger result; only `TIS Motorsports`. |
| `2023 BMW X5 22` | 2 exact | 2 preview cards | Passenger/luxury SUV result; only `TIS Motorsports`. |
| `BMW iX` | 24 exact | 10 preview cards | Parsed `BMW iX`, not Ford/Ranger; matched `5x112`; passenger result; only `TIS Motorsports`. |
| `show wheels for BMW iX` | 24 exact | 10 preview cards | Parsed `BMW iX`, not Ford/Ranger; matched `5x112`; passenger result; only `TIS Motorsports`. |
| `show 22 wheels for 2024 BMW iX` | 2 exact | 2 preview cards | Parsed `2024 BMW iX`, not Ford/Ranger; matched `5x112`; passenger result; only `TIS Motorsports`. |
| `2024 BMW iX 22 black` | 1 exact | 1 preview card | Parsed `2024 BMW iX`, not Ford/Ranger; matched `5x112`; passenger result; only `TIS Motorsports`. |
| `show TIS wheels for 2022 Honda Accord` | 0 blocked | 0 blocked | Explicit non-Motorsports passenger request blocked with clear message. |

## Verification Commands

- `npm run import-data` ✅
- `FITMENT_BASE_URL=http://localhost:4466 node scripts/smoke-fitment.mjs` ✅ — includes homepage API, direct SMS handler, `/api/sms-demo`, and `/api/twilio/sms`.
- `npx tsc --noEmit` ✅
- `npm run build` ✅
