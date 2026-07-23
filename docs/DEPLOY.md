# Deployment Runbook

From nothing to live, at **$0**. Roughly 30 minutes for Stage 1.

Written to be followed literally. Every stage is independently useful — you can
stop after Stage 1 and have a working public product.

---

## Stage 0 — Prerequisites

You already have a GitHub account and a Vercel account. That is everything Stage 1
needs.

Node.js is installed at `%LOCALAPPDATA%\nodejs` and has been added to your user
PATH. Open a **new** terminal and confirm:

```bash
node --version
```

Expect `v22.21.1`. If the command is not found, close and reopen your terminal —
PATH changes only apply to new sessions.

---

## Stage 1 — Get it live (free, ~30 min)

### 1.1 Verify locally

```bash
cd "D:\Edmonton Group of Businesses\ER Wait Time Navigator\app" && npm run verify
```

This runs typecheck, the full test suite, and a production build. All three must
pass. Expect 62 passing tests.

To view it in a browser first:

```bash
cd "D:\Edmonton Group of Businesses\ER Wait Time Navigator\app" && npm run dev
```

Then open http://localhost:3000.

### 1.2 Push to GitHub

From the project root (the folder containing `app/` and `business/`):

```bash
cd "D:\Edmonton Group of Businesses\ER Wait Time Navigator" && git init -b main && git add . && git commit -m "ER Wait Time Navigator: initial release"
```

Create the repository and push:

```bash
gh repo create er-wait-time-navigator --public --source=. --remote=origin --push
```

**Make it public.** Three concrete reasons: GitHub Actions minutes are unlimited on
public repositories, which is what makes 15-minute history capture free; a public
repo for a public-good health tool is a genuine trust and credibility signal; and it
costs you nothing, since there are no secrets in the code — every credential lives
in environment variables.

If you do not have the `gh` CLI, create the repo manually at github.com/new, then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/er-wait-time-navigator.git && git push -u origin main
```

### 1.3 Deploy on Vercel

1. Go to https://vercel.com/new
2. Import the repository.
3. **Set the Root Directory to `app`.** This is the one setting that is easy to get
   wrong — the repo root holds the business docs, and the Next.js project lives in
   `app/`. Vercel will fail the build if this is not set.
4. Framework preset should auto-detect as Next.js. Leave build settings alone.
5. Deploy.

It will build and give you a `*.vercel.app` URL. **The product is now live and
fully functional** — live wait times for all of Alberta, door-to-doctor ranking,
triage, alternatives, offline support, PWA install.

### 1.4 Set the site URL

In Vercel → your project → Settings → Environment Variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | your deployment URL, no trailing slash |
| `NEXT_PUBLIC_CONTACT_EMAIL` | a real address you monitor |

Redeploy for these to take effect (Deployments → ⋯ → Redeploy).

Without `NEXT_PUBLIC_SITE_URL`, canonical URLs and the sitemap will point at
localhost and search engines will index nothing useful.

### 1.5 Add a domain (optional, ~$15/yr)

Vercel → Settings → Domains → add your domain, then follow the DNS instructions.
Update `NEXT_PUBLIC_SITE_URL` to match and redeploy.

`.ca` domains signal local legitimacy and are worth the small premium here.

---

## Stage 2 — Start historical capture (free, ~20 min)

> **Do this immediately after Stage 1, before launch, before users, before the
> domain.**
>
> AHS publishes the current wait but keeps no public archive. History cannot be
> backfilled — every day you delay is a day permanently lost. It is the only asset
> in this business that a competitor cannot buy, copy, or catch up on, and it is
> free to start. This is the single highest-leverage action available.

### 2.1 Create a free Postgres database

**Neon** (https://neon.tech) or **Supabase** (https://supabase.com). Both have
genuinely free tiers that fit this workload comfortably.

Create a project, then copy the connection string. It looks like:

```
postgresql://user:password@host/dbname?sslmode=require
```

### 2.2 Apply the schema

If you have `psql`:

```bash
psql "YOUR_CONNECTION_STRING" -f "D:\Edmonton Group of Businesses\ER Wait Time Navigator\app\src\lib\db\schema.sql"
```

If not, open the SQL editor in the Neon or Supabase dashboard, paste the contents
of `app/src/lib/db/schema.sql`, and run it.

### 2.3 Generate a cron secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output.

### 2.4 Add environment variables in Vercel

| Name | Value |
|---|---|
| `DATABASE_URL` | your connection string |
| `CRON_SECRET` | the hex string from 2.3 |

Redeploy.

### 2.5 Verify the endpoint works

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-SITE/api/cron/snapshot
```

Expect JSON with `"ok": true` and a non-zero `rowsWritten`.

- `401` → the secret does not match what Vercel has.
- `"historyEnabled": false` → `DATABASE_URL` is not set, or you did not redeploy.
- `202` → upstream data was stale, so the write was skipped deliberately. Healthy;
  try again shortly.

### 2.6 Schedule it

The workflow at `.github/workflows/capture-snapshot.yml` is already written and runs
every 15 minutes.

> **Why not Vercel Cron?** Vercel's Hobby plan permits **daily** cron only, and a
> more frequent schedule causes the **deployment to fail**. `vercel.json` therefore
> declares a daily run as a safety net, and GitHub Actions does the real work.

In your GitHub repo → Settings → Secrets and variables → Actions → New repository
secret, add both:

| Secret | Value |
|---|---|
| `APP_URL` | your site URL, no trailing slash |
| `CRON_SECRET` | the same hex string |

Then Actions tab → "Capture wait-time snapshot" → **Run workflow** to test it
immediately. It should go green.

### 2.7 Confirm it is accumulating

After an hour, check the trends page. After a few days, facility pages will start
showing sparklines. After ~2 weeks, quiet-hour recommendations appear.

**Watch for:** GitHub disables scheduled workflows on repositories with no commits
for 60 days. If captures stop silently, check that first.

---

## Stage 3 — Wait-threshold alerts (free, ~10 min)

Requires Stage 2 (the database).

### 3.1 Generate VAPID keys

```bash
cd "D:\Edmonton Group of Businesses\ER Wait Time Navigator\app" && npx web-push generate-vapid-keys
```

### 3.2 Add to Vercel

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:your@email.com` |

Redeploy. The alert UI appears automatically on facility pages.

**Test it:** set an alert on a facility with a threshold well *above* its current
wait, then trigger a capture manually. You should get a notification.

> **iOS note:** the site must be added to the home screen before push works.
> The UI already explains this to users.

---

## Stage 4 — Better drive times (free, ~10 min, optional)

Default estimation is good enough to rank correctly and costs nothing. This upgrade
adds real road routing.

1. Sign up at https://openrouteservice.org/dev/#/signup — free, **no credit card**,
   2,000 requests/day.
2. Create a token.
3. Add `ORS_API_KEY` in Vercel. Redeploy.

The board automatically upgrades and its status line reflects the change. If the
provider fails or the quota runs out, it silently falls back to estimation — the
board never breaks.

**Google Routes** (`GOOGLE_ROUTES_API_KEY`) adds live traffic but requires billing.
Only worth it once revenue supports it.

---

## Stage 5 — Billing (only when ready)

**Do not do this until `business/01-BUSINESS-PLAN.md` §4.4 is satisfied**:
registered business, insurance in force, sustained traffic, 60+ days of data, and
real user demand for alerts.

1. Create a Stripe account with the registered business as the entity.
2. Create products and recurring prices for Plus and Family, monthly and annual.
3. Add in Vercel:

| Name | Value |
|---|---|
| `BILLING_ENABLED` | `true` |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | from the webhook endpoint |
| `STRIPE_PRICE_PLUS_MONTHLY` | price ID |
| `STRIPE_PRICE_PLUS_ANNUAL` | price ID |
| `STRIPE_PRICE_FAMILY_MONTHLY` | price ID |
| `STRIPE_PRICE_FAMILY_ANNUAL` | price ID |

4. Add a webhook endpoint in Stripe pointing at `https://YOUR-SITE/api/stripe/webhook`,
   subscribed to `customer.subscription.created`, `.updated`, and `.deleted`.

Billing requires **both** `BILLING_ENABLED=true` and a secret key. Either alone does
nothing, so a stray key can never start charging people.

---

## Post-deploy checklist

- [ ] Site loads and shows live wait times
- [ ] "Use my location" produces a ranked board with total times
- [ ] The 911 banner appears above everything, on every page
- [ ] Disable JavaScript and reload — the banner and wait times still render
- [ ] `/triage` reaches a "Call 911" result when a red flag is selected
- [ ] Airplane mode → navigating shows the offline page with working numbers
- [ ] "Add to Home Screen" works on a real phone
- [ ] `/sitemap.xml` lists your real domain, not localhost
- [ ] Submit the sitemap to Google Search Console and Bing Webmaster Tools
- [ ] Capture workflow is green and rows are accumulating

---

## Operations

### Routine checks

| Cadence | Check |
|---|---|
| Weekly | GitHub Actions is green; history has no gaps |
| Monthly | Every phone number in `care-options.ts` still connects |
| Quarterly | Compare our facility list against the AHS page for additions |
| Annually | Insurance renewal; clinical re-review |

### Troubleshooting

**"Wait times are unavailable right now"**
Upstream is failing. Confirm directly:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en
```
If AHS returns 200 but the site does not, check Vercel function logs. The app keeps
serving cached data for two hours before showing this message at all.

**Captures stopped**
Check GitHub Actions for the 60-day inactivity disable. Push any commit to
re-enable, then re-run the workflow manually.

**Trends page says "still collecting"**
Either `DATABASE_URL` is missing, or there is genuinely not enough data yet. Quiet
windows need at least 4 readings per hourly bucket.

**Alerts not delivering**
Confirm all three VAPID variables are set, the database is reachable, and — on
iOS — that the site was added to the home screen. Dead subscriptions are pruned
automatically.

### Rollback

Vercel → Deployments → pick the last good one → Promote to Production. Instant.

### Cost monitoring

Everything here fits free tiers at the traffic levels this business will see in
Year 1. The first ceiling you would hit is Vercel's function execution allowance,
which is a good problem and arrives well after revenue is possible.
