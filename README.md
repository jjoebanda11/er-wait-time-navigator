# ER Wait Time Navigator

**Live Alberta emergency department wait times, ranked by how long it will actually
take you to be seen — including the drive.**

Alberta Health Services publishes how long each emergency department expects you to
wait. It does not tell you which one will see *you* soonest. Those are different
questions, and the gap between them is measured in hours.

Verified on live data during the build, from Mill Woods in south-east Edmonton:

| | Grey Nuns | Leduc |
|---|---|---|
| Distance | **0.7 km** | 24.5 km |
| Posted wait | 4 hr 02 | 1 hr 52 |
| **Total time to be seen** | **4 hr 12** | **2 hr 25** |

The hospital 35× further away sees you nearly two hours sooner. No maps app knows
the queue. The AHS list does not know where you are.

---

## Status

**Built, tested, and verified against live data. Ready to deploy.**

- 62 automated tests passing
- Production build clean, 23 routes
- All routes smoke-tested against the live AHS feed
- Runs correctly with a completely empty `.env`
- **Not yet deployed. Not yet clinically reviewed. Not yet insured.**

---

## Start here

| If you want to… | Read |
|---|---|
| **Get it live today** | [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| Understand the business and what changed from the original plan | [`business/01-BUSINESS-PLAN.md`](business/01-BUSINESS-PLAN.md) |
| Know what must happen before promoting it | [`business/02-LEGAL-AND-SETUP.md`](business/02-LEGAL-AND-SETUP.md) |
| Launch it to real people | [`business/03-GO-TO-MARKET.md`](business/03-GO-TO-MARKET.md) |
| Get the triage logic reviewed by a clinician | [`docs/CLINICAL-REVIEW.md`](docs/CLINICAL-REVIEW.md) |
| Understand where the data comes from | [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md) |

**The three things that matter most, in order:**

1. **Deploy and start historical capture immediately.** AHS keeps no public
   archive. History cannot be backfilled, it is free to start, and it is the only
   asset in this business a competitor cannot buy or catch up on.
2. **Get insured and incorporated before promoting.** This is the real gating item,
   not money and not engineering.
3. **Get the triage content clinically reviewed.** Cheap, fast, and the single
   largest risk reduction available.

---

## What it does

**Free forever, no account, no tracking:**

- Live wait times for all seven reporting Alberta regions
- Door-to-doctor ranking: posted wait + your drive + parking and walk-in time
- Pediatric routing — prefers children's ERs, hides adult-only departments
- Symptom triage engineered to escalate on any doubt
- Alberta alternative care directory and crisis numbers
- Installable, works offline, offline page carries numbers that work with no data plan
- Public JSON API anyone can use

**Optional, activate with free-tier accounts:**

- Historical capture every 15 minutes → trend heatmaps and best-time-to-go
- Wait-threshold push alerts
- Real road routing, and live-traffic routing if ever justified
- Complete Stripe subscription system, **built but dark by default**

---

## Architecture in one paragraph

Next.js 15 App Router on Vercel's free tier. Wait times come from a public AHS JSON
endpoint that needs no key — there is no scraping — cached three minutes and shared
across all users, with a two-hour stale-serving grace period so an upstream outage
degrades to labelled old data rather than an error page. Ranking runs on the device
as pure arithmetic, so results appear instantly and work offline; a routing provider
refines drive times when one is configured. Postgres, push, and Stripe are each
optional and switch themselves on when their credentials appear.

**The governing design rule:** the app must run correctly with an empty `.env`.
That constraint is what turns "$150k and six months" into "deploy this afternoon."

---

## Local development

```bash
cd app && npm install && npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run verify` | Typecheck + tests + production build |
| `npm test` | Test suite |
| `npm run build` | Production build |

---

## Layout

```
ER Wait Time Navigator/
├── app/                         Next.js application
│   ├── src/lib/ahs/             Feed client, parser, types  ← core data layer
│   ├── src/lib/geo/             Distance and drive-time providers
│   ├── src/lib/rank.ts          Door-to-doctor ranking       ← core IP
│   ├── src/lib/triage/          Symptom triage engine        ← safety critical
│   ├── src/lib/care-options.ts  Alberta care directory       ← verify quarterly
│   ├── src/lib/db/              History capture and trends
│   ├── src/app/                 Routes and pages
│   └── src/components/          UI
├── business/                    Plan, legal path, go-to-market
├── docs/                        Deploy runbook, clinical review, data sources
├── research/                    Captured live AHS payload
└── .github/workflows/           15-minute capture schedule
```

---

## Important constraints

Documented because they are easy to break by accident.

- **Never coerce an unknown wait to zero.** A facility with no published wait must
  never rank as though it were fast. Enforced in the parser and tested.
- **Never let the triage tool lower acuity.** Modifiers may only escalate.
- **Never collect health information.** Symptom answers stay in the browser.
  Location stays on the device. This keeps us outside health-information
  regulation, and it is worth more than any feature that would break it.
- **Never paywall anything urgent.** The free tier is the business.
- **Never take a referral fee that could bias ranking.** Trust is the only real asset.
- **Vercel Hobby rejects sub-daily cron** and fails the *deployment*. History
  capture runs from GitHub Actions instead.

---

## Data and attribution

Wait times are published by [Alberta Health Services](https://www.albertahealthservices.ca/waittimes/waittimes.aspx)
as estimates, and can change without warning. This project is independent and is
not affiliated with, endorsed by, or operated by Alberta Health Services, Primary
Care Alberta, or the Government of Alberta.

**This software does not provide medical advice.** For a medical emergency call
911. For free 24/7 nurse advice in Alberta, call 811.
