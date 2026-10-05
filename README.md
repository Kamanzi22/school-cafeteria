# 🍽️ CaféCampus v3 — Full School Cafeteria Ordering Platform

## What's New in v3

### ✅ Restaurant Self-Registration
Restaurants create their own account at `/restaurant/auth` — no admin needed. Fill in owner details, restaurant name, emoji, category and they go live **instantly** on the student app.

### ✅ Restaurant Account Deletion
Owners can permanently delete their account from Settings → Danger Zone. Requires password confirmation. The restaurant **disappears immediately** from the student app via real-time socket event.

### ✅ Three Ways for Customers to Order
1. **Guest** — no account needed, just enter a name and start ordering
2. **Register** — full account with email + password, order history, loyalty points
3. **Student ID login** — log in with student ID + password

### ✅ Guest Upgrade Path
Guests can upgrade to a full account from their profile page without losing their session.

### ✅ Super Admin Panel
At `/superadmin` — oversee all restaurants, suspend/approve, view platform stats, force-delete restaurants.

---

## 🚀 Setup

```bash
# 1. Install everything
npm run install:all

# 2. Set up database + seed demo data
cd server && npx prisma migrate deploy && node src/prisma/seed.js && cd ..

# 3. Start the app
npm run dev
```

- **Student app** → http://localhost:5173
- **Restaurant registration/login** → http://localhost:5173/restaurant/auth
- **Super admin** → http://localhost:5173/superadmin

---

## 🔑 Credentials

### Super Admin
- URL: `/superadmin`
- Username: `superadmin` · Password: `super123`

### Demo Restaurant Owners (all password: `admin123`)
| Restaurant | Email |
|-----------|-------|
| 🍲 Mama Africa Kitchen | amina@mamaafrica.rw |
| 🍔 The Burger Spot | james@burgerspot.rw |
| 🥗 Green Bowl | sophie@greenbowl.rw |
| 🍕 Pizza Palace | marco@pizzapalace.rw |
| 🍜 Dragon Wok | lin@dragonwok.rw |
| ☕ Café Bonne Journée | celine@cafebj.rw |
| 🍛 Spice Route | raj@spiceroute.rw |

### Demo Customers (password: `password123`)
- alice@school.ac.rw or STU001
- bob@school.ac.rw or STU002
- **Or order as a Guest — no account needed**

---

## Architecture

| | |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| State | Zustand (persisted) |
| Backend | Node.js + Express |
| Database | SQLite via Prisma (swap to Postgres for production) |
| Real-time | Socket.io |
| Auth | JWT tokens (owner, staff, customer, guest, superadmin types) |

## Key Flows

### Restaurant registers itself:
`/restaurant/auth` → Register tab → fills form → gets JWT → lands on dashboard

### Restaurant deletes itself:
`/admin/settings` → Danger Zone → confirm password → soft-deleted → socket broadcasts to all students → disappears from home page

### Guest orders:
Home → pick restaurant → add to cart → "Continue as Guest" → place order → track order

### Customer registers:
`/auth` → Create Account tab → email + password → full account

---

## Deployment

Everything deploys from this repo (`Kamanzi22/school-cafeteria`, branch `main`) through the
Render Blueprint in `render.yaml`. Pushing to `main` redeploys the site and the API.

| Part | Where | Address |
|---|---|---|
| Website (customer, restaurant and super admin apps) | Render static site `cafecampus-client` | https://cafecampus.org.rw (also `www.`, `restaurant.`, `superadmin.`) |
| API | Render web service `cafecampus-api-eu`, Frankfurt | https://cafecampus-api-eu.onrender.com |
| Database and file storage | Supabase, AWS Paris (eu-west-3) | — |
| Daily database backup | GitHub Actions `backup-db.yml`, into the private Supabase `backups` bucket, kept 14 days | — |

The API runs in Frankfurt because it is next to the database (about 10 ms per query) and the
closest Render region to users in Kigali (about 150 ms). It moved there from Oregon on
2026-09-29, which made database-backed requests 2–3 times faster.

`kamanzi2025/school-cafeteria` is an old copy of this project with its workflows disabled. It is
not connected to the live app.

### Changing the database

Database changes ship as Prisma migration files in `server/prisma/migrations/`. Every API
deploy runs `prisma migrate deploy`, which applies only those files, so nothing is ever dropped
unless a migration says so. `prisma db push` is no longer used; don't run it against the live
database.

1. Edit `server/prisma/schema.prisma`.
2. With `DATABASE_URL`/`DIRECT_URL` pointing at a **local** Postgres (never the live one), run
   `cd server && npm run db:migrate -- --name what_changed`. This writes a new folder under
   `prisma/migrations/` and applies it locally.
3. Read the generated `migration.sql`. Renaming a column shows up as drop + add, which loses
   the data in it — edit the SQL to `ALTER TABLE … RENAME COLUMN …` instead.
4. Commit the migration folder together with the schema change.

The deploy also compares the live database with `schema.prisma` after migrating, and fails
(leaving the previous version running) if they differ — that's what happens if step 2 was
skipped. `0_init` is the starting point: it matches the database as it was on 2026-10-05 and
was marked as already applied there, so it never runs on the live database.

### Still to do

- **Delete the temporary Render API key** once no more Render changes are needed:
  Render → Account Settings → API Keys → delete `claude-frankfurt-move`, then run
  `rm ~/.render_key` on the Mac.
- **Remove the unused `VERCEL_TOKEN`** secret from this repo's GitHub settings
  (Settings → Secrets and variables → Actions), and revoke it in Vercel.
- **Turn on Dependabot alerts** (Settings → Code security) so GitHub warns about new
  vulnerable dependencies automatically. They are currently off.

### Small fixes (optional)

None of these affect the live app today; they are listed so they aren't forgotten.

- **Visits opened by name aren't counted.** A restaurant opened through a typed or shared
  address like `/restaurant/dragon-wok` sends the name instead of the restaurant's id to
  `POST /api/visits/start`, which fails, so that visit is missing from the super admin's
  visitor stats. The menu itself works, and links from the home page and search use the id.
  Fix: in `client/src/pages/student/RestaurantPage.jsx`, pass the loaded restaurant's id to
  `useVisitTracking` instead of the URL parameter.
- **Replace `uuid` with Node's built-in `crypto.randomUUID()`.** `npm audit` flags `uuid`
  (moderate), but the advisory is about `v3`/`v5`/`v6` with a buffer argument; the app only
  calls `v4()`, once, for guest tokens in `server/src/routes/orders.js`. Swapping that call
  for `require('crypto').randomUUID()` (same format) and removing the package clears it.
- **Upgrade Vite** (currently 5; `npm audit` suggests 8). The advisories for `vite` and
  `esbuild` only affect the local dev server (`npm run dev`), never the built app users
  download, and two are Windows-only. Because `client/vite.config.js` sets `host: true`,
  the dev server is reachable from other devices on the same network, so until then **don't
  run `npm run dev` on public or school Wi-Fi**. An upgrade changes how the app is built, so
  test every app shell (customer, restaurant, super admin, delivery) after it.
- **React Router 7** (currently 6). Its two advisories need server-side rendering or
  navigation to an attacker-controlled address (e.g. `?redirect=`), neither of which the app
  has. Version 7 is a major upgrade touching every page and link; only do it if a new
  advisory affects how this app uses the router.
- **Google sign-in limit on shared Wi-Fi.** `POST /api/auth/customer/google` allows 30
  attempts per 15 minutes per visitor IP (`googleLimiter` in `server/src/routes/auth.js`).
  Students on the same school Wi-Fi share one IP, so if "Too many sign-in attempts" shows up
  at rush hour, raise that limit.
