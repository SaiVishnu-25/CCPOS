/* ==========================================================================
   CCPOS — Configuration EXAMPLE
   --------------------------------------------------------------------------
   Copy this file to `config.js` and fill in your own Supabase keys:

       copy config.example.js config.js        (Windows)
       cp config.example.js config.js           (macOS/Linux)

   `config.js` is GITIGNORED, so your real keys are never pushed to GitHub.

   For Vercel: do NOT create config.js manually. Instead add these Environment
   Variables in the Vercel dashboard, and the build step generates config.js:

       SUPABASE_URL        = https://YOUR-PROJECT.supabase.co
       SUPABASE_ANON_KEY   = your-anon-public-key

   Leave both empty to run in OFFLINE DEMO MODE (localStorage).

   NEVER put your service_role key here. Only the anon public key is safe.
   ========================================================================== */

window.CCPOS_CONFIG = {
  supabaseUrl: "",       // e.g. "https://abcdefghijk.supabase.co"
  supabaseAnonKey: ""    // e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
};

/* Demo accounts available in local mode (no Supabase) */
window.CCPOS_DEMO = {
  student: { email: "student@campus.edu", password: "student" },
  faculty: { email: "faculty@campus.edu", password: "faculty" },
  guest:   { email: "guest@campus.edu",   password: "guest" },
  staff:   { email: "staff@campus.edu",   password: "staff" },
  admin:   { email: "admin@campus.edu",   password: "admin" }
};
