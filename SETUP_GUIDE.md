# CCPOS — Setup & Deployment Guide

## ⚠️ IMPORTANT: UI/UX Commitment
**All UI/UX files must NOT be modified:**
- `index.html` — structure and layout
- `style.css` — styling, animations, dark mode, responsive design
- `app.js` — view functions, routing, UI logic
- Any changes to these will break the design your professor will see

Only the **backend/Supabase configuration** should be modified/added.

---

## Step 1: Create Supabase Free Tier Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Project name: `ccpos-college-project` (or any name)
4. Organization: Select your org or create new
5. Password: Set a secure password for your DB
6. Region: Choose closest to your college (e.g., `ap-south-1` for India, `us-east-1` for US)
7. Click **Create new project**

**Wait for provisioning** — this takes ~2-3 minutes.

---

## Step 2: Run the SQL Schema

Once the project is ready:

1. In Supabase Dashboard, go to **SQL Editor** → **New Query**
2. **Copy and paste the entire contents** of `CCPOS-main/supabase-schema.sql`
3. Click **Run** (▶️ button)

**What this does:**
- Creates tables: `profiles`, `menu_items`, `orders`, `order_items`, `favorites`
- Sets up **Row Level Security (RLS)** policies
- Creates auto-profile trigger on signup
- Seeds 12 menu items
- Adds the "promote first admin" SQL comment

**If you get errors**, make sure you're connected to the correct project and the SQL is valid.

---

## Step 3: Configure Supabase Keys

After running the schema:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://abcdefghijk.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

3. **Two ways to configure** (choose one):

### Option A: Local Development (config.js file)

1. In `CCPOS-main/`, create a file named `config.js`:
   ```
   copy config.example.js config.js
   ```
   
2. Edit `config.js` and paste:
   ```javascript
   window.CCPOS_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-ANON-PUBLIC-KEY"
   };
   ```
   
3. **`config.js` is already in `.gitignore`** — it will never be committed to GitHub

### Option B: Vercel Deployment (Environment Variables)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Import your GitHub repo `SaiVishnu-25/CCPOS`
3. In the project dashboard, go to **Settings** → **Environment Variables**
4. Add two variables:
   - `SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-public-key`
5. **Leave Build Command as-is**: `node scripts/build-config.js`
6. Click **Save** and **Deploy**

Vercel will automatically run the build script and generate `dist/config.js` with your keys.

---

## Step 4: First Admin Setup

**Critical**: After setup, you must create the first admin account:

1. Open your deployed app (or run locally)
2. **Sign up** with any email/password — you'll become a `student` role
3. Go to **Supabase SQL Editor** and run:
   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'YOUR-EMAIL@example.com';
   ```
4. Sign out and sign back in → you'll now have **Admin** access
5. Go to the "Staff / Admin" tab on login to manage staff

**Alternative** — in demo mode without Supabase:
- Use the built-in demo accounts (admin: `admin@campus.edu` / password: `admin`)
- But limited — you won't be able to create staff via the Edge Function unless deployed

---

## Step 5: Push to GitHub

Your repo is `SaiVishnu-25/CCPOS`. Here's what to do:

### 5.1 Initialize Git (if not already)

```bash
cd CCPOS-main
git init
git add .
git commit -m "Initial CCPOS project - Campus Cafeteria Pre-Ordering System"
git branch -M main
git remote add origin https://github.com/SaiVishnu-25/CCPOS.git
git push -u origin main
```

### 5.2 What GitHub will see (and won't see)

**✅ Will be committed (safe):**
- `index.html`, `style.css`, `app.js` (all UI)
- `store.js` (data layer)
- `config.example.js` (template)
- `package.json`, `vercel.json`, `PLAN.md`, `README.md`
- `supabase-schema.sql`
- `supabase/functions/admin-users/index.ts`
- `.gitignore` (protects secrets)

**✅ Will NOT be committed (gitignored):**
- `config.js` — your real Supabase keys
- `dist/` — built output
- `.vercel/`, `node_modules/`
- Any `*.local.js` files

**⚠️ Important**: Never edit or commit `config.js`. Always use Vercel env vars or keep it local.

---

## Step 6: Vercel Deployment (Free Hosting)

### 6.1 If using GitHub + Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import GitHub repo `SaiVishnu-25/CCPOS`
3. Framework Preset: **Other**
4. Root Directory: `.` (or leave blank)
5. **Environment Variables** (add these):
   - `SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-public-key`
6. **Build Command**: `node scripts/build-config.js` (already set)
7. **Output Directory**: `.` (or `dist` depending on Vercel detection)
8. Click **Deploy**

### 6.2 First Deploy

- Vercel will run `node scripts/build-config.js`
- If env vars are set: `dist/config.js` will be generated with Supabase keys
- If no env vars: site runs in **demo mode** (localStorage fallback)
- After deploy, visit your `*.vercel.app` URL

### 6.3 Auto-Deployments

- Every `git push` to GitHub automatically deploys to Vercel
- No credit card needed — free hobby tier
- To update: just push changes, Vercel rebuilds

---

## Step 7: Admin Users Edge Function

The `admin-users` edge function is already in `supabase/functions/admin-users/index.ts` and handles:

- **Create staff/admin**: Admin can create new staff accounts via the console
- **Delete staff/admin**: Admin can delete accounts (can't delete self)

**No local setup needed** — just deploy it once:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-users
```

**Or** — simply use Vercel deployment (Step 6), and the edge function works in the Supabase backend automatically when `SUPABASE_SERVICE_ROLE_KEY` is available in the Edge runtime.

---

## Step 8: Testing Your Setup

### 8.1 Demo Mode (no keys)
- Open `index.html` directly or deploy to Vercel without env vars
- All roles work: student, faculty, guest
- Use demo accounts from `config.example.js`:
  - Student: `student@campus.edu` / `student`
  - Faculty: `faculty@campus.edu` / `faculty`
  - Guest: `guest@campus.edu` / `guest`
  - Staff: `staff@campus.edu` / `staff`
  - Admin: `admin@campus.edu` / `admin`

### 8.2 Live Mode (with Supabase keys)
- Configure either `config.js` (local) or Vercel env vars
- Sign up new accounts — they'll auto-create profiles in Supabase
- Staff/admin must be created by an existing admin (via edge function or SQL)
- All data persists in Supabase Postgres

### 8.3 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Supabase not initialized" | Ensure config.js has keys OR Vercel env vars are set |
| Auth sign-up fails | Check email confirmation is OFF in Supabase Dashboard → Authentication → Providers → Email |
| Menu items not appearing | Run the SQL schema again, ensure `supabase-schema.sql` ran fully |
| Can't create staff | Ensure edge function is deployed, or use SQL: `insert into profiles` with role='staff' |
| Dark mode not working | Check `window.CCPOS_THEME_KEY` is being set correctly |

---

## ✅ Complete Checklist Before Submitting to Professor

- [ ] Supabase project created and SQL schema run
- [ ] Supabase keys configured (Vercel env vars OR config.js)
- [ ] First admin account created (SQL: `update profiles set role='admin'`)
- [ ] Git repo pushed with `config.js` gitignored
- [ ] Vercel deployed with auto-deploy from GitHub
- [ ] All UI files unchanged (index.html, style.css, app.js visual)
- [ ] Project works in both demo and live modes
- [ ] Professor can log in as student/faculty/guest and order food
- [ ] Professor can access Admin Console (if using live mode)
- [ ] All 12 menu items visible and functional

---

## 📁 File Summary — What You're Uploading

```
CCPOS-main/
├── index.html              ✅ UI unchanged
├── style.css               ✅ UI unchanged  
├── app.js                  ✅ UI unchanged (view logic)
├── store.js                ✅ Data + Supabase adapter
├── config.example.js       ✅ Safe to commit
├── .gitignore              ✅ Protects secrets
├── package.json
├── vercel.json
├── PLAN.md
├── README.md
├── supabase-schema.sql     ✅ Run this in Supabase
├── supabase/functions/
│   └── admin-users/
│       └── index.ts       ✅ Edge function complete
└── scripts/
    └── build-config.js     ✅ Vercel build helper
```

---

## 🎯 Quick Start Summary (5 Minutes)

1. **Supabase**: Create project → Run SQL schema → Get keys
2. **Configure**: Either add `config.js` (local) OR Vercel env vars
3. **First admin**: Run SQL `update profiles set role='admin'`
4. **Git**: `git init → add → commit → push`
5. **Vercel**: Import GitHub → Add env vars → Deploy
6. **Test**: Visit your URL, sign up, explore

**Total cost: ₹0** (Free tier: Supabase + Vercel + GitHub)

---

Need help with any specific step? Let me know and I'll guide you through it!