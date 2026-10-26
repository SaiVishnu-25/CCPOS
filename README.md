# 🍱 CCPOS — Campus Cafeteria Pre-Ordering System

A modern, fully responsive web app where **students, faculty and guests** pre-order canteen food, and **staff & admins** manage the menu, orders and staff. Built as a college project with a **100% free** stack: **Vercel + Supabase + GitHub**.

---

## ✨ Features

### For Students / Faculty / Guests
- 🔐 Sign up & sign in (roles: student, faculty, guest)
- 🍽️ Browse the daily menu with search, category & dietary filters
- ❤️ Favorites, ⭐ ratings, item detail modal
- 🛒 Cart + checkout with pickup time slots & payment method
- 📍 Live order tracking (Placed → Preparing → Ready → Picked Up) + printable receipt
- 📜 Order history & one-tap re-order
- 👩‍🏫 **Faculty perk:** 10% discount + priority badge

### For Staff
- 📋 Live order board — start preparing, mark ready, mark picked up
- 🍽️ Menu manager — add / edit / delete dishes, toggle sold-out
- 🔄 Auto-refreshing dashboard

### For Admin
- 📊 Overview with revenue, orders & active staff KPIs
- 👥 **Staff management** — create staff/admin accounts, promote/demote, enable/disable, delete
- 🍽️ Full menu manager + 📋 order board
- 📈 Analytics — top sellers, revenue, wastage insight

### UI / UX
- 🎨 Food-themed design, glassmorphism cards, dark/light mode
- 🍕 **Floating animated stickers** drifting across every page
- ✨ Staggered card entrances, hover lifts, cart-badge bounce, toast notifications
- 📱 Fully responsive (mobile, tablet, desktop)

---

## 🔐 Roles & Access

| Role | How they get an account | What they can do |
|------|------------------------|------------------|
| **Student** | Self sign-up | Order, track, favorites, history |
| **Faculty** | Self sign-up | Same as student + 10% off |
| **Guest** | Self sign-up | Order, track (parents/visitors) |
| **Staff** | Created by Admin | Manage menu + fulfil orders |
| **Admin** | Created by Admin / promoted | Everything + manage staff |

Staff and Admin use the **separate “Staff / Admin” tab** on the login page. They cannot self-register — only an admin can provision them.

---

## 🧪 Try it instantly (Demo Mode — no setup)

The app ships with **zero-config demo mode** (uses `localStorage`). Just open `index.html` in any browser.

**Demo accounts** (also available as one-click chips on the login page):

| Role | Email | Password |
|------|-------|----------|
| Student | `student@campus.edu` | `student` |
| Faculty | `faculty@campus.edu` | `faculty` |
| Guest | `guest@campus.edu` | `guest` |
| Staff | `staff@campus.edu` | `staff` |
| Admin | `admin@campus.edu` | `admin` |

> In demo mode the admin can create new staff accounts directly from **Admin Console → Staff → Add Staff**.

---

## 🚀 Go Live — Free Stack

### Step 1 — Supabase (database + auth)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of [`supabase-schema.sql`](supabase-schema.sql), and click **Run**.
3. Go to **Authentication → Providers → Email** and **turn OFF “Confirm email”** for a smooth college demo (optional but recommended).
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
5. For **local testing**, copy the example config and paste your keys in:

```powershell
copy config.example.js config.js
```

```js
window.CCPOS_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-PUBLIC-KEY"
};
```

> `config.js` is **gitignored** — your keys are never pushed to GitHub.
> For the deployed site, set `SUPABASE_URL` / `SUPABASE_ANON_KEY` in Vercel instead (Step 3).

6. **Create your first admin:**
   - Open the app and **Sign up** normally (you'll become a `student`).
   - In Supabase **SQL Editor**, run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR-EMAIL@example.com';
```

   - Sign out and sign back in → you'll land in the **Admin Console**.

7. **Enable admin → create staff (optional, recommended):**
   Deploy the included Edge Function so the “Add Staff” button can create real accounts:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-users
```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — no extra secrets needed. Free tier includes Edge Functions.

> If you skip step 7, admin can still **promote / disable / delete** existing accounts, and you can create staff manually in **Supabase Dashboard → Authentication → Users** then set their `role` in the `profiles` table.

### Step 2 — GitHub

The repo is already initialised. To push changes later:

```bash
git add .
git commit -m "your message"
git push
```

### Step 3 — Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Other**.
3. Root directory: `./`
4. **Environment Variables** (Project Settings → Environment Variables) — add:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `SUPABASE_ANON_KEY` | your **anon public** key |

   These are only stored in Vercel — never in GitHub.

5. Build command: `node scripts/build-config.js` · Output directory: `dist`
   (already configured in `vercel.json`).
6. Click **Deploy**. Done — you get a free `*.vercel.app` URL.

> The build script generates `config.js` from those env vars into `dist/`.
> If you skip the env vars, the deployed site still runs in **demo mode**.

> Every `git push` auto-deploys. Free tier, no credit card.

### Step 4 — Lock down Supabase (recommended)

In **Authentication → URL Configuration**, set:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** `https://your-app.vercel.app`

---

## 🗂️ Project Structure

```
CCPOS/
├── index.html                     # App shell (navbar, cart, modals)
├── style.css                      # Theme, animations, floating stickers, responsive
├── app.js                         # Routing, views, role logic, actions
├── store.js                       # Data + auth layer (Supabase ⇄ local fallback)
├── config.example.js              # Template config (safe to commit)
├── config.js                      # Your real keys — GITIGNORED, never committed
├── scripts/build-config.js        # Vercel build: env vars → dist/config.js
├── supabase-schema.sql            # Tables, RLS policies, trigger, menu seed
├── supabase/functions/admin-users # Edge Function: admin creates/deletes staff
├── vercel.json                    # Vercel build + static config
├── .gitignore                     # Keeps config.js and .env* out of Git
├── PLAN.md                        # Project plan & architecture
└── README.md                      # This file
```

### 🔒 Keeping keys private

| Where | What to do |
|-------|------------|
| **GitHub** | Only `config.example.js` is committed. `config.js`, `.env*` are ignored (verified with `git check-ignore`). |
| **Vercel** | Add `SUPABASE_URL` + `SUPABASE_ANON_KEY` as Environment Variables; the build generates `config.js` inside `dist/`. |
| **Supabase** | The **anon public** key is the only key the browser needs. The **service_role** key lives only in the Edge Function runtime. |

> ⚠️ Never paste your `service_role` key into `config.js`, GitHub, or any frontend file.

---

## 🧠 How it works

- **Smart adapter (`store.js`)** — the UI talks to one async API. If `config.js` has Supabase keys it uses **Supabase Auth + Postgres**; otherwise it runs in **offline demo mode** with seeded data. This means the site never breaks during a demo.
- **Security** — Row Level Security (RLS) enforces that:
  - everyone can read the menu,
  - only staff/admin can write the menu or update orders,
  - users only see their own orders, favorites and profile,
  - only admins can manage staff.
- **Role detection** — the app reads your `profiles.role` and routes you to the correct dashboard.
- **Provisioning** — the `admin-users` Edge Function verifies the caller is an admin (via JWT) before using the service role to create/delete accounts.

---

## 💸 Cost breakdown (all free)

| Service | Free tier |
|---------|-----------|
| **GitHub** | Unlimited public repos |
| **Vercel** | Hobby plan — static hosting, auto-deploy |
| **Supabase** | Free tier — Postgres, Auth, RLS, Edge Functions |
| **Fonts** | Google Fonts (free) |
| **Icons** | Emoji (no cost) |

**Total: ₹0**

---

## 🛠️ Customisation tips

- **Change colors:** edit CSS variables at the top of `style.css` (`--brand`, `--green`, etc.).
- **Add menu items:** use the Staff/Admin **Menu Manager**, or edit the seed in `supabase-schema.sql`.
- **Change pickup slots:** edit the `SLOTS` array in `app.js`.
- **Faculty discount:** change `0.10` in `discountRate()` in `app.js`.

---

## 📄 License

MIT — free to use for your college project. Attribution appreciated but not required.
