/* ==========================================================================
   CCPOS — Vercel build helper
   Generates `dist/config.js` from environment variables so real Supabase keys
   are NEVER committed to GitHub, and copies the static site into `dist/`.

   Vercel runs this automatically (see vercel.json):
       Build command:    node scripts/build-config.js
       Output directory: dist

   Locally you can run it too:  node scripts/build-config.js
   (or just copy config.example.js to config.js and open index.html directly)
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

const url =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  "";

/* ---- 1. Build config.js from the committed example (keeps valid syntax) ---- */
let config = fs.readFileSync(path.join(root, "config.example.js"), "utf8");
config = config.replace(/supabaseUrl:\s*"[^"]*"/, `supabaseUrl: ${JSON.stringify(url)}`);
config = config.replace(/supabaseAnonKey:\s*"[^"]*"/, `supabaseAnonKey: ${JSON.stringify(key)}`);

/* ---- 2. Fresh dist/ folder with only the files the site needs ---- */
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const assets = ["index.html", "style.css", "app.js", "store.js"];
for (const file of assets) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
fs.writeFileSync(path.join(dist, "config.js"), config, "utf8");

console.log(
  url
    ? `✅ dist/ built — Supabase enabled (${url})`
    : "⚙️  dist/ built — no Supabase env vars found, running in demo mode"
);
