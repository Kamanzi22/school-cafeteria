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
