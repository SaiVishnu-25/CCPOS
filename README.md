# 🍱 CCPOS — Campus Cafeteria Pre-Ordering System

A modern, responsive web application designed for campus cafeterias. **Students, faculty, and guests** can browse menus, place pre-orders, and track meal preparation in real-time, while **staff and administrators** manage kitchen fulfillment, menu items, and user accounts.

---

## ✨ Key Features

### For Customers (Students / Faculty / Guests)
- 🔐 **Authentication & Profiles:** Role-based access with custom privileges (Student, Faculty, Guest).
- 🍽️ **Interactive Menu:** Browse categories, search items, and filter by dietary preferences (Veg, Non-Veg, Vegan, Gluten-Free).
- ❤️ **Favorites & Ratings:** Save frequently ordered items and rate dishes.
- 🛒 **Cart & Checkout:** Real-time cart calculations, pickup time slot selection, and flexible payment simulation.
- 📍 **Order Tracking:** Live status timeline (Placed → Preparing → Ready → Picked Up) and printable order receipts.
- 📜 **Order History:** View past orders with one-click re-ordering.
- 👩‍🏫 **Faculty Discount:** Automatic 10% discount badge for verified faculty.

### For Staff
- 📋 **Live Kitchen Board:** Manage order fulfillment pipeline (Start Preparing, Mark Ready, Mark Picked Up).
- 🍽️ **Menu Management:** Add, edit, remove items, or toggle daily availability/sold-out status.
- 🔄 **Real-Time Updates:** Dynamic order updates without page reloads.

### For Administrators
- 📊 **Executive Dashboard:** Live metrics for revenue, total orders, active staff, and average prep time.
- 👥 **Staff Provisioning:** Create, manage, activate, deactivate, or remove staff and administrative accounts.
- 📈 **Analytics & Insights:** Sales performance, top-selling items, and inventory trends.

### Modern UI / UX
- 🎨 Food-themed modern aesthetic with glassmorphism styling and dark/light mode toggle.
- 🍕 Playful animated sticker physics and smooth micro-interactions.
- 📱 Fully responsive layout tailored for mobile devices, tablets, and desktops.

---

## 🔐 Roles & Permissions

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **Student** | Self Sign-up | Order meals, schedule pickup, live tracking, favorites, history |
| **Faculty** | Self Sign-up | All Student permissions + automatic **10% discount** |
| **Guest** | Self Sign-up | Ordering & tracking for visitors and campus guests |
| **Staff** | Admin-Provisioned | Menu management + kitchen order fulfillment board |
| **Admin** | Admin-Provisioned | Full system control: staff provisioning, menu, orders, analytics |

*Note: Staff and Admin access requires provisioning by an administrator and authentication via the dedicated Staff/Admin portal.*

---

## 🚀 Quickstart

### 1. Instant Demo Mode (Zero Setup)
The application works immediately out of the box with zero configuration required. All data persists locally via `localStorage`.

1. Open `index.html` in any modern web browser.
2. Log in using any of the preset demo accounts (also accessible via one-click chips on the sign-in screen):

| Role | Email | Password |
|------|-------|----------|
| **Student** | `student@campus.edu` | `student` |
| **Faculty** | `faculty@campus.edu` | `faculty` |
| **Guest** | `guest@campus.edu` | `guest` |
| **Staff** | `staff@campus.edu` | `staff` |
| **Admin** | `admin@campus.edu` | `admin` |

---

### 2. Backend Integration (Optional)
To connect a cloud database and authentication service:

1. **Database Schema:** Execute [`supabase-schema.sql`](supabase-schema.sql) in your database editor to initialize the required tables, Row Level Security (RLS) policies, and starter menu items.
2. **Configuration:** Copy the template configuration file:
   ```bash
   cp config.example.js config.js
   ```
   Add your project credentials to `config.js`:
   ```javascript
   window.CCPOS_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-ANON-PUBLIC-KEY"
   };
   ```
   *(Note: `config.js` is included in `.gitignore` to keep credentials secure.)*

3. **Cloud Deployment (Vercel):**
   - Import the repository into Vercel.
   - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in **Project Settings → Environment Variables**.
   - The build script (`scripts/build-config.js`) will automatically generate the configuration file at deploy time.

---

## 🩺 Troubleshooting

### The deployed site loads, but the menu is empty and sign-in / sign-up fails

This means Vercel is connected to Supabase, but the **database schema was never applied** (the `public.menu_items` and `public.profiles` tables do not exist yet). The app now shows a setup banner in this case.

1. Open your project's **SQL Editor**: `https://supabase.com/dashboard/project/<PROJECT-REF>/sql/new`
2. Paste the **entire** [`supabase-schema.sql`](supabase-schema.sql) file and click **Run**.
   - It is idempotent — safe to run again later.
   - It creates the tables, RLS policies, API grants, the signup trigger and the starter menu.
   - It also backfills profiles for accounts that signed up before the schema existed.
3. Reload the deployed site. The menu and accounts should now work — no redeploy needed.
4. Promote your own account to admin (after signing up normally):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### Staff/Admin console cannot create accounts

The Admin Console uses the `admin-users` Edge Function. Deploy it once:

```bash
supabase functions deploy admin-users
```

(or paste [`supabase/functions/admin-users/index.ts`](supabase/functions/admin-users/index.ts) into **Dashboard → Edge Functions → Deploy a new function**).

---

## 🗂️ Project Structure

```
CCPOS/
├── index.html                     # App shell (navigation, views, cart, modals)
├── style.css                      # Design system, animations, themes, responsiveness
├── app.js                         # Application router, UI view controllers, state logic
├── store.js                       # Data access layer (backend adapter with local fallback)
├── config.example.js              # Template configuration
├── supabase-schema.sql            # Database tables, RLS policies, seed data
├── supabase/functions/admin-users # Edge function for staff user management
├── scripts/build-config.js        # Deployment build script for environment variables
├── vercel.json                    # Hosting and routing configuration
├── PLAN.md                        # Architecture & system design specification
└── README.md                      # Project documentation
```

---

## 🧠 Architecture & Design

- **Dual-Mode Adapter (`store.js`):** Unified asynchronous data interface. When cloud credentials are provided, the app connects to the live backend; otherwise, it seamlessly falls back to offline local storage.
- **Row-Level Security (RLS):** Granular access policies enforce that customer data remains private, public users can only view active menus, and kitchen/administrative actions are restricted to authenticated staff.
- **Role Isolation:** Enforces customer vs. operational boundaries at both application routing and database policy levels.

---

## 🛠️ Customization

- **Branding & Theme:** Customize the CSS variables in [`style.css`](style.css) (`--brand`, `--green`, `--surface`, etc.).
- **Pickup Slots:** Modify the available time intervals in the `SLOTS` definition inside [`app.js`](app.js).
- **Discounts:** Adjust the discount rate in `discountRate()` inside [`app.js`](app.js).

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
