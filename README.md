# Spendly — Daily Expense Tracker

A single-user daily expense tracker built with **Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Supabase, Recharts, date-fns, lucide-react and sonner**. No accounts, no login — anyone who opens the site sees the same data.

**Highlights:** History calendar heatmap, per-day detail page with a Day Journal, timeline with infinite scroll, search + filters, dashboard, budgets, recurring transactions (auto-generated on app load, no cron), reports, CSV import/export, dark mode, mobile bottom navigation.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up / log in (free plan is fine).
2. Click **New project**, pick an organization, give it a name (e.g. `spendly`), set a database password (save it somewhere), choose the region closest to you, then **Create new project**.
3. Wait ~1–2 minutes until the project finishes provisioning.

## 2. Find the Project URL and the anon / publishable key

1. In your project, open **Project Settings** (gear icon, bottom-left) → **API** (newer dashboards: **API Keys** / **Data API**).
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the key:
   - the legacy **`anon` `public`** key, **or**
   - the newer **publishable** key (`sb_publishable_...`).

   > Both work with `supabase-js`. Use either one as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Never** use the `service_role` / secret key.

## 3. Run `supabase/schema.sql`

1. In Supabase, open **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **all** of it, paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned".
4. (Optional) Check **Table Editor** — you should see `categories`, `transactions`, `day_notes`, `budgets`, `recurring_transactions`, `payment_methods`, `settings`.

The script is safe to re-run. It enables Row Level Security on every table and adds policies that let the `anon` role read/write everything (this is a no-login app), and seeds the default categories, payment methods and settings.

## 4. Fill in `.env.local` and run locally

```bash
npm install
```

Open `.env.local` and fill in the two values (no quotes, no spaces):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Then:

```bash
npm run dev
```

Open <http://localhost:3000>. If you see a yellow "Supabase isn't connected yet" banner, the variables are empty — fill them in and restart `npm run dev`.

## 5. Push the project to GitHub

1. Create an empty repository on <https://github.com/new> (don't add a README/.gitignore). Keep it **Private** if you like.
2. In the project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

`.env.local` is in `.gitignore`, so your keys are **not** pushed.

## 6. Import the GitHub repo into Vercel

1. Go to <https://vercel.com> and log in with GitHub.
2. Click **Add New… → Project**.
3. Find your repo in the list and click **Import** (grant Vercel access to the repo if asked).
4. Framework preset should auto-detect **Next.js**. Leave build settings as they are.
5. **Before clicking Deploy**, add the environment variables (next step).

## 7. Add the environment variables in Vercel

On the import screen expand **Environment Variables** (or later: **Project → Settings → Environment Variables**) and add both:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon or publishable key |

Keep all environments (Production, Preview, Development) ticked, then click **Deploy**.

## 8. Important: redeploy after changing variables

`NEXT_PUBLIC_*` variables are **embedded into the app at build time**. If you add or change them in Vercel after a deploy, you must **redeploy** (Project → **Deployments** → latest deployment → **⋯ → Redeploy**) for the change to take effect.

---

## Using the app

- **+ button** (bottom-right on every page) adds a transaction. Date and time default to now.
- **History → Calendar**: each day shows its total, shaded by how much you spent. Click a day for the **Day Detail** page: all transactions in time order, totals, a category chart, a **Day Journal** (autosaves), add/edit/duplicate/delete, and previous/next day.
- **History → Timeline**: newest-first, grouped by day with daily totals, infinite scroll. Use the search box and **Filters** (date range, category, payment method, tag, type, min/max amount).
- **Budgets**: set an overall and per-category monthly limit. Bars turn yellow at 80% and red at 100%; you get a warning toast when a new expense pushes a budget over.
- **Recurring**: rent, subscriptions, salary. Due items are created automatically whenever the app loads (last generated date is tracked in the DB so nothing is duplicated).
- **Reports**, **Import / Export (CSV)** and **Settings** (currency, week start, theme, payment methods, delete all data).

## Project structure

```
supabase/schema.sql        # run once in the Supabase SQL Editor
src/app/                   # routes: dashboard, history, history/[date], budgets, recurring,
                           #         categories, reports, data, settings
src/components/            # app shell, shared UI, charts, history views, shadcn/ui
src/hooks/                 # app data context, query hook, transaction dialog
src/lib/                   # supabase client, db queries, formatting, csv, stats, icons
src/types/                 # TypeScript types matching the schema
```

## Scripts

`npm run dev` · `npm run build` · `npm run start` · `npm run lint`

## Notes

- There is **no authentication**. Anyone with the site URL (and the public anon key, which is visible in the browser) can read and modify the data. That is intentional for this single-user app — don't store anything sensitive, and consider keeping the Vercel URL private (or enabling Vercel Deployment Protection).
