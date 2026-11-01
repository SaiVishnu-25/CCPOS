/* ==========================================================================
   CCPOS — Store (data + auth layer)
   --------------------------------------------------------------------------
   Two interchangeable adapters:
     • LocalAdapter    → localStorage, seeded demo data, zero setup
     • SupabaseAdapter → real Auth + Postgres, used when config.js has keys
   Both expose the same async API so the UI never needs to know the difference.
   ========================================================================== */

(function () {
  const CFG = window.CCPOS_CONFIG || {};
  const LOCAL_KEY = "ccpos_local_v3";
  const THEME_KEY = "ccpos_theme";
  const CART_PREFIX = "ccpos_cart_";

  const USE_SUPABASE =
    !!CFG.supabaseUrl &&
    !!CFG.supabaseAnonKey &&
    typeof window.supabase !== "undefined";

  let supa = null;
  let local = null;

  /* ---------------------------------------------------------------- */
  /*  HELPERS                                                          */
  /* ---------------------------------------------------------------- */
  const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 10);
  const money = (n) => Number(n) || 0;

  function cartKey() {
    return CART_PREFIX + (local?.session || localStorage.getItem("ccpos_uid") || "guest");
  }
  function readCart() {
    try { return JSON.parse(localStorage.getItem(cartKey()) || "[]"); }
    catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(cartKey(), JSON.stringify(cart));
  }

  /* ---------------------------------------------------------------- */
  /*  SEED DATA (local mode)                                           */
  /* ---------------------------------------------------------------- */
  const MENU_SEED = [
    { name: "Margherita Pizza", category: "Lunch", price: 120, emoji: "🍕", desc: "Classic wood-fired pizza with fresh basil, mozzarella and tomato.", prepTime: 15, dietary: "Veg", available: true, rating: 4.7, badge: "Chef's Special" },
    { name: "Cheese Burger", category: "Lunch", price: 95, emoji: "🍔", desc: "Juicy patty, cheddar, lettuce, tomato and our secret sauce.", prepTime: 12, dietary: "Non-Veg", available: true, rating: 4.6, badge: "Popular" },
    { name: "Masala Dosa", category: "Breakfast", price: 60, emoji: "🥞", desc: "Crispy dosa with spiced potato filling and coconut chutney.", prepTime: 10, dietary: "Veg", available: true, rating: 4.8, badge: "" },
    { name: "French Fries", category: "Snacks", price: 50, emoji: "🍟", desc: "Golden crispy fries tossed with salt and peri-peri seasoning.", prepTime: 8, dietary: "Vegan", available: true, rating: 4.4, badge: "" },
    { name: "Cold Coffee", category: "Drinks", price: 45, emoji: "🥤", desc: "Chilled coffee blended with milk and ice, topped with cream.", prepTime: 5, dietary: "Veg", available: true, rating: 4.5, badge: "" },
    { name: "Paneer Wrap", category: "Lunch", price: 85, emoji: "🌯", desc: "Grilled paneer, veggies and mint mayo in a soft tortilla.", prepTime: 10, dietary: "Veg", available: true, rating: 4.6, badge: "" },
    { name: "Chicken Biryani", category: "Lunch", price: 150, emoji: "🍛", desc: "Fragrant basmati rice slow-cooked with spiced chicken.", prepTime: 20, dietary: "Non-Veg", available: true, rating: 4.9, badge: "Popular" },
    { name: "Samosa", category: "Snacks", price: 25, emoji: "🥟", desc: "Crispy pastry filled with spiced potato and peas.", prepTime: 5, dietary: "Veg", available: true, rating: 4.3, badge: "" },
    { name: "Fresh Lime Soda", category: "Drinks", price: 30, emoji: "🍋", desc: "Refreshing lime soda, sweet or salted, served chilled.", prepTime: 4, dietary: "Vegan", available: true, rating: 4.2, badge: "" },
    { name: "Chocolate Brownie", category: "Desserts", price: 55, emoji: "🍩", desc: "Warm fudgy brownie with a molten chocolate centre.", prepTime: 6, dietary: "Veg", available: true, rating: 4.8, badge: "Chef's Special" },
    { name: "Veg Sandwich", category: "Snacks", price: 40, emoji: "🥪", desc: "Toasted sandwich with fresh veggies and cheese.", prepTime: 7, dietary: "Veg", available: true, rating: 4.1, badge: "" },
    { name: "Mango Smoothie", category: "Drinks", price: 50, emoji: "🥭", desc: "Thick and creamy mango smoothie made with fresh fruit.", prepTime: 5, dietary: "Vegan", available: false, rating: 4.5, badge: "" }
  ];

  function buildLocalDB() {
    return {
      users: [
        { id: "u_admin", name: "Campus Admin", email: "admin@campus.edu", password: "admin", role: "admin", active: true, createdAt: new Date().toISOString() },
        { id: "u_staff", name: "Canteen Staff", email: "staff@campus.edu", password: "staff", role: "staff", active: true, createdAt: new Date().toISOString() },
        { id: "u_student", name: "Aarav Student", email: "student@campus.edu", password: "student", role: "student", active: true, createdAt: new Date().toISOString() },
        { id: "u_faculty", name: "Dr. Meera Faculty", email: "faculty@campus.edu", password: "faculty", role: "faculty", active: true, createdAt: new Date().toISOString() },
        { id: "u_guest", name: "Ravi Guest", email: "guest@campus.edu", password: "guest", role: "guest", active: true, createdAt: new Date().toISOString() }
      ],
      menu: MENU_SEED.map((m, i) => ({ id: "m" + (i + 1), image: "", ...m })),
      orders: [],
      favorites: [],
      session: null
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    const db = buildLocalDB();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
    return db;
  }
  function saveLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  }
  const publicUser = (u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt
  });

  /* ---------------------------------------------------------------- */
  /*  LOCAL ADAPTER                                                    */
  /* ---------------------------------------------------------------- */
  const LocalAdapter = {
    mode: "local",
    user: null,

    async init() {
      local = loadLocal();
      if (local.session) {
        const u = local.users.find((x) => x.id === local.session);
        if (u && u.active) {
          this.user = publicUser(u);
        } else {
          this.user = null;
          local.session = null;
          localStorage.removeItem("ccpos_uid");
          saveLocal();
        }
      }
      return this.user;
    },

    async login(email, password) {
      const u = local.users.find(
        (x) => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password
      );
      if (!u) throw new Error("Invalid email or password.");
      if (!u.active) throw new Error("This account has been deactivated. Contact the admin.");
      local.session = u.id;
      localStorage.setItem("ccpos_uid", u.id);
      saveLocal();
      this.user = publicUser(u);
      return this.user;
    },

    async signup({ name, email, password, role }) {
      if (!["student", "faculty", "guest"].includes(role)) {
        throw new Error("This role can only be created by an admin.");
      }
      if (String(password).length < 6) throw new Error("Password must be at least 6 characters.");
      if (local.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      const u = {
        id: uid("u"), name: name.trim(), email: email.trim(),
        password, role, active: true, createdAt: new Date().toISOString()
      };
      local.users.push(u);
      local.session = u.id;
      localStorage.setItem("ccpos_uid", u.id);
      saveLocal();
      this.user = publicUser(u);
      return this.user;
    },

    async logout() {
      local.session = null;
      localStorage.removeItem("ccpos_uid");
      saveLocal();
      this.user = null;
    },

    async getMenu() {
      return local.menu.map((m) => ({ ...m }));
    },

    async addMenuItem(data) {
      const item = { id: uid("m"), image: "", rating: 4.5, badge: "", ...data };
      local.menu.push(item);
      saveLocal();
      return item;
    },

    async updateMenuItem(id, data) {
      const item = local.menu.find((m) => m.id === id);
      if (!item) throw new Error("Item not found.");
      Object.assign(item, data);
      saveLocal();
      return item;
    },

    async deleteMenuItem(id) {
      local.menu = local.menu.filter((m) => m.id !== id);
      saveLocal();
    },

    async getOrders() {
      if (!this.user) return [];
      const all = [...local.orders].reverse();
      if (["staff", "admin"].includes(this.user.role)) return all;
      return all.filter((o) => o.userId === this.user.id);
    },

    async createOrder(order) {
      const rec = {
        id: uid("ord"), userId: this.user.id, studentName: order.customerName,
        role: order.role, items: order.items, total: order.total,
        slot: order.slot, payment: order.payment, status: "placed",
        createdAt: new Date().toISOString()
      };
      local.orders.push(rec);
      saveLocal();
      return rec;
    },

    async updateOrderStatus(id, status) {
      const o = local.orders.find((x) => x.id === id);
      if (!o) throw new Error("Order not found.");
      o.status = status;
      saveLocal();
      return o;
    },

    async getFavorites() {
      if (!this.user) return [];
      return local.favorites.filter((f) => f.userId === this.user.id).map((f) => f.itemId);
    },

    async toggleFavorite(itemId) {
      if (!this.user) throw new Error("Please sign in first.");
      const idx = local.favorites.findIndex((f) => f.userId === this.user.id && f.itemId === itemId);
      let added;
      if (idx >= 0) { local.favorites.splice(idx, 1); added = false; }
      else { local.favorites.push({ userId: this.user.id, itemId }); added = true; }
      saveLocal();
      return added;
    },

    async getUsers() {
      return local.users.map(publicUser);
    },

    async adminCreateUser({ name, email, password, role }) {
      if (!["staff", "admin"].includes(role)) throw new Error("Invalid staff role.");
      if (String(password).length < 6) throw new Error("Password must be at least 6 characters.");
      if (local.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      const u = {
        id: uid("u"), name: name.trim(), email: email.trim(),
        password, role, active: true, createdAt: new Date().toISOString()
      };
      local.users.push(u);
      saveLocal();
      return publicUser(u);
    },

    async updateUser(id, patch) {
      const u = local.users.find((x) => x.id === id);
      if (!u) throw new Error("User not found.");
      if (patch.name !== undefined) u.name = patch.name;
      if (patch.role !== undefined) u.role = patch.role;
      if (patch.active !== undefined) u.active = patch.active;
      saveLocal();
      return publicUser(u);
    },

    async deleteUser(id) {
      local.users = local.users.filter((u) => u.id !== id);
      saveLocal();
    },

    getCart() { return readCart(); },
    setCart(cart) { writeCart(cart); }
  };

  /* ---------------------------------------------------------------- */
  /*  SUPABASE ADAPTER                                                 */
  /* ---------------------------------------------------------------- */
  const mapProfile = (r) => ({
    id: r.id, name: r.full_name || r.email, email: r.email,
    role: r.role, active: r.active, createdAt: r.created_at
  });

  const mapMenu = (r) => ({
    id: r.id, name: r.name, category: r.category, price: Number(r.price),
    desc: r.description || "", emoji: r.emoji || "🍽️", image: r.image_url || "",
    prepTime: r.prep_time ?? 10, dietary: r.dietary || "Veg",
    available: !!r.available, rating: Number(r.rating) || 4.5, badge: r.badge || ""
  });

  const mapOrder = (r) => ({
    id: r.id, userId: r.user_id, studentName: r.customer_name,
    role: r.role, status: r.status, total: Number(r.total),
    slot: r.pickup_slot, payment: r.payment_method, createdAt: r.created_at,
    items: (r.order_items || []).map((i) => ({
      id: i.menu_item_id, name: i.name, price: Number(i.price),
      qty: i.qty, emoji: i.emoji, dietary: i.dietary
    }))
  });

  /* Turn low-level PostgREST errors into actionable messages. */
  const friendlyDbError = (err) => {
    const code = err?.code || "";
    const msg = String(err?.message || err || "");
    if (code === "PGRST205" || code === "42P01" || /could not find the table|relation .* does not exist/i.test(msg)) {
      return new Error(
        "Supabase is connected, but its database is not initialised (tables are missing). " +
        "Open the Supabase SQL Editor and run supabase-schema.sql, then reload this page."
      );
    }
    if (code === "42501" || /permission denied/i.test(msg)) {
      return new Error(
        "Supabase permissions are missing. Re-run supabase-schema.sql to apply the API grants, then reload this page."
      );
    }
    return err instanceof Error ? err : new Error(msg || "Database request failed.");
  };

  const SupabaseAdapter = {
    mode: "supabase",
    user: null,
    schemaReady: true,
    schemaError: null,

    async _profile(id) {
      const { data, error } = await supa.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw friendlyDbError(error);
      return data ? mapProfile(data) : null;
    },

    async init() {
      supa = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });

      // Probe once so the UI can explain a missing/uninitialised schema instead
      // of silently showing an empty menu.
      const probe = await supa.from("menu_items").select("id").limit(1);
      if (probe.error) {
        this.schemaReady = false;
        this.schemaError = friendlyDbError(probe.error);
      } else {
        this.schemaReady = true;
        this.schemaError = null;
      }

      const { data } = await supa.auth.getSession();
      if (data.session?.user) {
        this.user = await this._profile(data.session.user.id);
        if (this.user) localStorage.setItem("ccpos_uid", this.user.id);
        if (this.user && !this.user.active) {
          await supa.auth.signOut();
          this.user = null;
        }
      }
      return this.user;
    },

    async login(email, password) {
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw friendlyDbError(error);
      this.user = await this._profile(data.user.id);
      if (!this.user) throw new Error("Profile not found. Please contact the admin.");
      if (!this.user.active) {
        await supa.auth.signOut();
        throw new Error("This account has been deactivated. Contact the admin.");
      }
      localStorage.setItem("ccpos_uid", this.user.id);
      return this.user;
    },

    async signup({ name, email, password, role }) {
      if (!["student", "faculty", "guest"].includes(role)) {
        throw new Error("Staff and admin accounts are created by an admin.");
      }
      const { data, error } = await supa.auth.signUp({
        email, password,
        options: { data: { full_name: name, role } }
      });
      if (error) throw friendlyDbError(error);
      if (!data.session) {
        throw new Error("Almost there! Please confirm your email, then sign in.");
      }
      // Wait briefly for the DB trigger to create the profile
      let profile = null;
      for (let i = 0; i < 6 && !profile; i++) {
        profile = await this._profile(data.user.id);
        if (!profile) await new Promise((r) => setTimeout(r, 400));
      }
      if (!profile) {
        this.user = {
          id: data.user.id, name, email, role: "student", active: true,
          createdAt: new Date().toISOString()
        };
      } else {
        this.user = profile;
      }
      localStorage.setItem("ccpos_uid", this.user.id);
      return this.user;
    },

    async logout() {
      await supa.auth.signOut();
      localStorage.removeItem("ccpos_uid");
      this.user = null;
    },

    async getMenu() {
      const { data, error } = await supa.from("menu_items").select("*").order("created_at", { ascending: true });
      if (error) throw friendlyDbError(error);
      return (data || []).map(mapMenu);
    },

    async addMenuItem(d) {
      const { data, error } = await supa.from("menu_items").insert({
        name: d.name, category: d.category, price: d.price, description: d.desc,
        emoji: d.emoji, image_url: d.image || null, prep_time: d.prepTime,
        dietary: d.dietary, available: d.available, rating: d.rating ?? 4.5, badge: d.badge || null
      }).select().single();
      if (error) throw friendlyDbError(error);
      return mapMenu(data);
    },

    async updateMenuItem(id, d) {
      const { data, error } = await supa.from("menu_items").update({
        name: d.name, category: d.category, price: d.price, description: d.desc,
        emoji: d.emoji, image_url: d.image || null, prep_time: d.prepTime,
        dietary: d.dietary, available: d.available, badge: d.badge || null
      }).eq("id", id).select().single();
      if (error) throw friendlyDbError(error);
      return mapMenu(data);
    },

    async deleteMenuItem(id) {
      const { error } = await supa.from("menu_items").delete().eq("id", id);
      if (error) throw friendlyDbError(error);
    },

    async getOrders() {
      let q = supa.from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (!["staff", "admin"].includes(this.user.role)) q = q.eq("user_id", this.user.id);
      const { data, error } = await q;
      if (error) throw friendlyDbError(error);
      return (data || []).map(mapOrder);
    },

    async createOrder(order) {
      const { data: created, error } = await supa.from("orders").insert({
        user_id: this.user.id, customer_name: order.customerName,
        role: order.role, status: "placed", total: order.total,
        pickup_slot: order.slot, payment_method: order.payment
      }).select().single();
      if (error) throw friendlyDbError(error);

      const rows = order.items.map((i) => ({
        order_id: created.id, menu_item_id: i.id, name: i.name,
        price: i.price, qty: i.qty, emoji: i.emoji, dietary: i.dietary
      }));
      const { error: e2 } = await supa.from("order_items").insert(rows);
      if (e2) throw friendlyDbError(e2);

      return {
        id: created.id, userId: this.user.id, studentName: order.customerName,
        role: order.role, status: "placed", total: order.total,
        slot: order.slot, payment: order.payment, createdAt: created.created_at,
        items: order.items
      };
    },

    async updateOrderStatus(id, status) {
      const { error } = await supa.from("orders").update({ status }).eq("id", id);
      if (error) throw friendlyDbError(error);
    },

    async getFavorites() {
      if (!this.user) return [];
      const { data, error } = await supa.from("favorites")
        .select("menu_item_id").eq("user_id", this.user.id);
      if (error) throw friendlyDbError(error);
      return (data || []).map((f) => f.menu_item_id);
    },

    async toggleFavorite(itemId) {
      if (!this.user) throw new Error("Please sign in first.");
      const { data } = await supa.from("favorites")
        .select("menu_item_id").eq("user_id", this.user.id).eq("menu_item_id", itemId).maybeSingle();
      if (data) {
        await supa.from("favorites").delete().eq("user_id", this.user.id).eq("menu_item_id", itemId);
        return false;
      }
      const { error } = await supa.from("favorites").insert({ user_id: this.user.id, menu_item_id: itemId });
      if (error) throw friendlyDbError(error);
      return true;
    },

    async getUsers() {
      const { data, error } = await supa.from("profiles").select("*").order("created_at", { ascending: true });
      if (error) throw friendlyDbError(error);
      return (data || []).map(mapProfile);
    },

    async adminCreateUser(d) {
      const { data, error } = await supa.functions.invoke("admin-users", {
        body: { action: "create", name: d.name, email: d.email, password: d.password, role: d.role }
      });
      if (error) {
        throw new Error(
          "Could not create the account. Make sure the 'admin-users' Edge Function is deployed. (" + error.message + ")"
        );
      }
      if (data?.error) throw new Error(data.error);
      return data.user;
    },

    async updateUser(id, patch) {
      const payload = {};
      if (patch.name !== undefined) payload.full_name = patch.name;
      if (patch.role !== undefined) payload.role = patch.role;
      if (patch.active !== undefined) payload.active = patch.active;
      const { data, error } = await supa.from("profiles").update(payload).eq("id", id).select().single();
      if (error) throw friendlyDbError(error);
      return mapProfile(data);
    },

    async deleteUser(id) {
      const { data, error } = await supa.functions.invoke("admin-users", {
        body: { action: "delete", id }
      });
      if (error) throw new Error("Could not delete the account. Is the Edge Function deployed? (" + error.message + ")");
      if (data?.error) throw new Error(data.error);
    },

    getCart() { return readCart(); },
    setCart(cart) { writeCart(cart); }
  };

  /* ---------------------------------------------------------------- */
  /*  EXPORT                                                           */
  /* ---------------------------------------------------------------- */
  window.Store = USE_SUPABASE ? SupabaseAdapter : LocalAdapter;
  window.CCPOS_THEME_KEY = THEME_KEY;
})();
