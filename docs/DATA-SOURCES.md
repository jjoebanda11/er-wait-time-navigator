# Data Sources & Verification Schedule

Every external fact this product asserts, where it came from, and when it must be
re-checked. A wrong phone number on a crisis line is the worst defect this software
could ship, so nothing in the care directory may be written from memory.

**Last full verification: 2026-07-22.**

---

## Primary data feed

**Alberta Health Services estimated emergency department wait times**

```
https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en
```

| Property | Value |
|---|---|
| Authentication | None required |
| Discovered via | Network trace of the public AHS wait times page |
| Public page | https://www.albertahealthservices.ca/waittimes/Page14230.aspx |
| `robots.txt` | Disallows only `/org/` and `/rls/` — this path is permitted |
| Verified | 2026-07-22, HTTP 200 to plain `curl`, ~15 KB |
| Our read frequency | At most once per 3 minutes, cached and shared across all users |
| Regions returned | Edmonton, Calgary, Red Deer, Lethbridge, Medicine Hat, Grande Prairie, Fort McMurray |
| Facilities in sample | 29 records → 30 after splitting compound records |

### Response shape

Region keys at the top level, each containing `Emergency` and sometimes `Urgent`
arrays. Per-facility fields: `Name`, `Category`, `WaitTime`, `URL`, `Note`,
`TimesUnavailable`, `Address`, `GoogleMapsLinkDirection`, `SiteId`, `SplitFacility`,
`SiteClosingSoon`, `SiteOpen`.

### Quirks the parser handles

Each of these is covered by a test. If AHS changes any of them, a test fails rather
than a user being misled.

| Quirk | Handling |
|---|---|
| `WaitTime` is a display string (`"3 hr 38 min"`) | Parsed to minutes |
| `"Wait times unavailable"` sentinel | → `null`, **never** `0` |
| Compound records joined by `[;]` | Exploded into separate facilities |
| Coordinates only exist inside the maps URL | Parsed out; no geocoding needed |
| `Note` contains HTML entities and `<br />` | Decoded and normalised |
| Some `Address` values contain newlines | Collapsed |
| Municipality is embedded in the address | Extracted, handling `St. Albert` vs. street `St` |

A live sample is preserved at `research/ahs-sample.json` and used as a test fixture,
so a change in upstream structure surfaces as a failing test.

**Re-check quarterly:** compare our facility list against the AHS page. New sites
appear automatically, but a structural change would not.

---

## Care options directory

Source of truth: `app/src/lib/care-options.ts`.

| Item | Detail | Source | Verified |
|---|---|---|---|
| **Health Link 811** | Free 24/7 registered-nurse advice; some callers offered Virtual MD by phone or video | Primary Care Alberta | 2026-07-22 |
| **Health Information Chat** | Live online chat with a nurse, plus callback request; 7 days/week, 8 a.m.–10 p.m.; explicitly **not** for urgent or emergency concerns | Primary Care Alberta | 2026-07-22 |
| **Pharmacist prescribing** | Alberta pharmacists have the broadest prescribing scope in Canada; assessment covered by AHCIP with a valid Alberta Health card, ~$25 without | Alberta Health / College of Pharmacy | 2026-07-22 |
| **Urgent care centres** | Same-day non-emergency care; live waits in the AHS feed | AHS | 2026-07-22 |
| **988 Suicide Crisis Helpline** | Call or text, 24/7, Canada-wide | Government of Canada | 2026-07-22 |
| **Alberta Mental Health Help Line** | 1-877-303-2642, 24/7 | AHS | 2026-07-22 |
| **Access 24/7 (Edmonton)** | 780-424-2424, mental health assessment and crisis support | AHS | 2026-07-22 |
| **PADIS** | 1-800-332-1414, poison and drug information, 24/7 | AHS | 2026-07-22 |
| **Kids Help Phone** | 1-800-668-6868, or text CONNECT to 686868 | Kids Help Phone | 2026-07-22 |

> **Verify every phone number monthly by dialling it.** This is not optional
> maintenance. Ten minutes a month.
>
> Note also that Alberta's health system was restructured — Primary Care Alberta and
> Acute Care Alberta now hold responsibilities formerly under AHS. Service ownership
> and URLs may move; the numbers are the durable part.

---

## Derived calculations — ours, not AHS's

These are clearly labelled as our estimates everywhere they appear.

| Calculation | Method | Where |
|---|---|---|
| **Road distance** | Haversine × 1.35 circuity factor (standard planning figure for North American grid networks) | `geo/haversine.ts` |
| **Drive time** | Distance-tiered average speeds: 26 km/h under 3 km, 38 under 10, 52 under 25, 72 beyond | `geo/haversine.ts` |
| **Parking + walk-in** | 12 min at major tertiary sites, 8 at mid-size, 5 at community sites | `geo/haversine.ts` |
| **Door-to-doctor** | drive + parking + posted wait | `rank.ts` |
| **Time saved** | Versus the median of known options, not the worst — the realistic counterfactual | `rank.ts` |

**Calibrate the parking allowances** against real experience once the product has
users. They are reasoned estimates, not measurements, and they meaningfully affect
ranking between a large tertiary hospital and a community site.

---

## Verification schedule

| Cadence | Task |
|---|---|
| **Monthly** | Dial every phone number in `care-options.ts` |
| **Quarterly** | Diff our facility list against the AHS page; re-read care descriptions for policy changes |
| **Annually** | Full re-verification of every row here; clinical re-review |
| **On test failure** | Investigate immediately — a parser test failing means AHS changed something |

**Any user report of inaccuracy jumps the queue, ahead of every feature.** In this
category, accuracy is the product.
