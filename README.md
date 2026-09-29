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
cd server && npx prisma db push && node src/prisma/seed.js && cd ..

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

### Still to do

- **Delete the old Oregon API.** The service `cafecampus-api` (address `cafecampus-api-feu3.onrender.com`)
  is suspended: it costs nothing and nothing uses it. To remove it for good:
  1. Remove its entry (the first service) from `render.yaml` and push, so the Blueprint
     does not recreate it. Don't touch `cafecampus-api-eu`.
  2. In the Render dashboard, open `cafecampus-api` → Settings → Delete Web Service.
  Until then, don't click **Resume** on it, since that would start billing again.
- **Delete the temporary Render API key** once no more Render changes are needed:
  Render → Account Settings → API Keys → delete `claude-frankfurt-move`, then run
  `rm ~/.render_key` on the Mac.
- **Remove the unused `VERCEL_TOKEN`** secret from this repo's GitHub settings
  (Settings → Secrets and variables → Actions), and revoke it in Vercel.
