// ============================================================================
// CCPOS — Supabase Edge Function: admin-users
// Lets an authenticated ADMIN create or delete staff accounts (service role).
//
// Deploy:
//   supabase functions deploy admin-users
//   (set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — provided
//    automatically by Supabase in the Edge runtime)
//
// Free tier includes Edge Functions, so this stays ₹0.
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const admin = createClient(url, serviceKey);
    const asUser = createClient(url, anonKey);

    // 1. Verify caller (pass the JWT explicitly)
    const { data: { user }, error: authErr } = await asUser.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // 2. Verify caller is an active admin
    const { data: profile } = await admin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin" || !profile.active) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const action = body.action;

    // 3. Create staff/admin
    if (action === "create") {
      const { name, email, password, role } = body;
      if (!name || !email || !password) return json({ error: "Missing fields" }, 400);
      if (!["staff", "admin"].includes(role)) return json({ error: "Invalid role" }, 400);
      if (String(password).length < 6) return json({ error: "Password must be 6+ characters" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: "student" },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // Promote profile to staff/admin (service role bypasses RLS)
      const { error: upsertErr } = await admin.from("profiles").upsert({
        id: created.user!.id,
        full_name: name,
        email,
        role,
        active: true,
      });
      if (upsertErr) return json({ error: upsertErr.message }, 400);

      return json({
        user: { id: created.user!.id, name, email, role, active: true },
      });
    }

    // 4. Delete a staff/admin account
    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      if (id === user.id) return json({ error: "You cannot delete yourself" }, 400);

      await admin.from("profiles").delete().eq("id", id);
      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
