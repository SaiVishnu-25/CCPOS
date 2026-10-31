# CCPOS — Campus Cafeteria Pre Ordering System
## Project Plan & Architecture

---

## 1. Problem Statement
Students face long queues and wait times at peak lunch hours, food wastage from unsold items, and no visibility into what's available before they reach the counter. Canteen staff struggle to manage the menu and fulfil orders efficiently.

CCPOS is a web app where students, faculty and guests browse the daily canteen menu, pre-order and pay ahead of time, while staff manage the menu and fulfil orders — and admins manage the staff.

---

## 2. Roles & Permissions

| Role | Account creation | Permissions |
|------|------------------|-------------|
| **Student** | Self sign-up | Browse, order, pay, track, favorites, history |
| **Faculty** | Self sign-up | Same as student + **10% discount** + priority badge |
| **Guest** | Self sign-up | Parents/visitors — browse, order, track |
| **Staff** | Created by Admin | Manage menu (add/edit/delete/sold-out) + fulfil orders |
| **Admin** | Created by Admin / promoted | Everything + **manage staff** + analytics |

- Staff/Admin use a **separate login tab** — they cannot self-register.
- Public sign-up is clamped to `student | faculty | guest`.
- Role changes and staff provisioning are admin-only (enforced by RLS + Edge Function).

---

## 3. Feature Set

### Student / Faculty / Guest
- Daily menu with search, category & dietary filters
- Item detail modal with quantity selector
- Cart drawer with live totals
- Checkout: pickup slot + payment method (simulated)
- Order tracking timeline (Placed → Preparing → Ready → Picked Up)
- Order history + one-tap re-order
- Favorites + printable receipt
- Faculty 10% discount

### Staff
- Live order board — Start Preparing → Mark Ready → Mark Picked Up / Cancel
- Menu manager — add, edit, delete, toggle availability
- Auto-refresh (pauses while typing)

### Admin
- Overview KPIs: revenue, orders, active orders, active staff
- **Staff management** — create staff/admin, promote/demote, enable/disable, delete
- Menu manager + order board
- Analytics: top sellers, revenue, sold-out/wastage insight

### UI / UX
- Food-themed palette, glassmorphism, dark/light mode
- Floating animated food stickers on every page
- Staggered card entrances, hover lifts, cart-badge bounce, toasts
- Fully responsive (mobile / tablet / desktop)

---

## 4. Architecture (100% Free)

```
GitHub  →  Vercel (static hosting)  →  Supabase (Auth + Postgres + RLS + Edge Functions)
```

- **Frontend:** HTML + CSS + vanilla JS — no build step, deploys as static files.
- **Backend:** Supabase Auth + Postgres; Row Level Security enforces roles.
- **Smart fallback:** if `config.js` has no Supabase keys, the app runs in **offline demo mode** using `localStorage` with seeded data — perfect for a quick demo.
- **Admin provisioning:** the `admin-users` Edge Function verifies the caller's JWT, confirms they are an active admin, then uses the service role to create/delete staff accounts.

### Deployment Architecture
- **Web Hosting:** Vercel (Static Hosting)
- **Database & Auth:** Supabase (PostgreSQL, Auth, RLS)
- **Source Control:** GitHub

---

## 5. Data Model

```
profiles      id, full_name, email, role, active, created_at
menu_items    id, name, category, price, description, emoji, image_url,
              prep_time, dietary, available, rating, badge, created_at
orders        id, user_id, customer_name, role, status, total,
              pickup_slot, payment_method, created_at
order_items   id, order_id, menu_item_id, name, price, qty, emoji, dietary
favorites     user_id, menu_item_id  (composite PK)
```

RLS summary:
- Menu: everyone reads; staff/admin write.
- Orders: users see their own; staff/admin see all and update.
- Favorites: own only.
- Profiles: own read; staff read all; **admin only** can change roles/status.
- No self-promotion policy.

---

## 6. Auth Flows

1. **Customer sign-up** → `auth.signUp` with metadata `{ full_name, role }` → DB trigger creates a `profiles` row (role clamped to customer roles).
2. **Login** → `auth.signInWithPassword` → load profile → check `active` → route by role.
3. **Staff/Admin login** → same, but accounts are provisioned by an admin.
4. **First admin** → sign up normally, then run one SQL statement to set `role='admin'` (documented in README).

---

## 7. File Structure

```
CCPOS/
├── index.html                     # App shell
├── style.css                      # Theme, animations, stickers, responsive
├── config.js                      # Supabase keys + demo accounts
├── store.js                       # Supabase ⇄ local adapter
├── app.js                         # Router, views, role logic, actions
├── supabase-schema.sql            # Schema, RLS, trigger, seed
├── supabase/functions/admin-users # Edge Function for staff provisioning
├── vercel.json                    # Static hosting config
├── PLAN.md                        # This document
└── README.md                      # Project documentation
```

---

## 8. Build Status

| Area | Status |
|------|--------|
| Student / Faculty / Guest auth + flows | ✅ Done |
| Staff console (orders + menu) | ✅ Done |
| Admin console (staff + menu + orders + analytics) | ✅ Done |
| Local demo mode | ✅ Done |
| Supabase adapter + RLS + Edge Function | ✅ Done (requires keys) |
| Responsive UI + dark mode + stickers | ✅ Done |
| Free deployment docs | ✅ Done |

---

## 9. Success Criteria
- ✅ Runs instantly with zero setup (demo mode)
- ✅ Students, faculty, guests can self-register and order
- ✅ Staff/Admin have separate login and correct permissions
- ✅ Admin can create/manage staff
- ✅ Staff manages the menu and fulfils orders
- ✅ Data persists (Supabase in production, localStorage in demo)
- ✅ Deployable via GitHub → Vercel + Supabase
