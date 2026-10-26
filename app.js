/* ==========================================================================
   CCPOS — Campus Cafeteria Pre Ordering System
   App: auth, routing, views (student / faculty / guest / staff / admin)
   ========================================================================== */

/* ------------------------------------------------------------------ */
/*  CONSTANTS + STATE                                                  */
/* ------------------------------------------------------------------ */
const SLOTS = ["11:30 - 11:45", "11:45 - 12:00", "12:00 - 12:15", "12:15 - 12:30", "12:30 - 12:45", "12:45 - 13:00"];
const CATEGORIES = ["All", "Breakfast", "Lunch", "Snacks", "Drinks", "Desserts"];
const DIETARY = ["All", "Veg", "Vegan", "Non-Veg"];
const ROLE_META = {
  student: { label: "Student", emoji: "🎓" },
  faculty: { label: "Faculty", emoji: "👩‍🏫" },
  guest: { label: "Guest", emoji: "🧑‍🤝‍🧑" },
  staff: { label: "Staff", emoji: "👨‍🍳" },
  admin: { label: "Admin", emoji: "🛡️" }
};

const state = {
  view: "home",
  user: null,
  menu: [],
  orders: [],
  favorites: [],
  users: [],
  cart: [],

  authTab: "customer",     // customer | staff
  authView: "login",       // login | signup

  search: "",
  category: "All",
  dietary: "All",

  checkoutOpen: false,
  checkoutStep: "cart",    // cart | checkout
  selectedSlot: "12:00 - 12:15",
  paymentMethod: "Card",

  cartOpen: false,
  itemQty: 1,
  activeItem: null,
  trackingId: null,

  consoleTab: "orders",
  staffSearch: "",
  staffRoleFilter: "all"
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => "₹" + Number(n || 0).toFixed(0);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg, type = "success") {
  const cont = $("#toastContainer");
  if (!cont) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  const icon = type === "error" ? "⚠️" : type === "warn" ? "🔔" : "✅";
  el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  cont.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-exit");
    setTimeout(() => el.remove(), 260);
  }, 3400);
}

function roleBadge(role) {
  const m = ROLE_META[role] || { label: role, emoji: "🙂" };
  return `<span class="role-badge ${role}">${m.emoji} ${m.label}</span>`;
}

function statusLabel(s) {
  return {
    placed: "🕐 Placed", preparing: "👨‍🍳 Preparing",
    ready: "✅ Ready", completed: "📦 Picked Up", cancelled: "❌ Cancelled"
  }[s] || s;
}

function itemById(id) {
  return state.menu.find((m) => m.id === id);
}

/* Cart maths */
function cartCount() {
  return state.cart.reduce((s, c) => s + c.qty, 0);
}
function cartSubtotal() {
  return state.cart.reduce((s, c) => {
    const it = itemById(c.id);
    return s + (it ? it.price * c.qty : 0);
  }, 0);
}
function discountRate() {
  return state.user?.role === "faculty" ? 0.10 : 0;
}
function cartFee() {
  return state.cart.length ? 5 : 0;
}
function cartTotal() {
  return Math.round(cartSubtotal() * (1 - discountRate()) + cartFee());
}

function persistCart() {
  Store.setCart(state.cart);
  renderCart();
  updateCartBadge();
}

/* ------------------------------------------------------------------ */
/*  FLOATING STICKERS                                                  */
/* ------------------------------------------------------------------ */
function initStickers() {
  const layer = $("#stickers");
  if (!layer) return;
  const emojis = ["🍕", "🍔", "🍟", "🥤", "🍩", "🥪", "🍋", "🥭", "🍛", "🥟", "🌯", "🍰"];
  const count = window.innerWidth < 768 ? 8 : 14;
  layer.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "sticker";
    s.textContent = emojis[i % emojis.length];
    s.style.fontSize = (1.6 + Math.random() * 2.6) + "rem";
    s.style.left = Math.random() * 95 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.opacity = 0.11 + Math.random() * 0.18;
    s.style.animation = `stickerFloat ${8 + Math.random() * 8}s ease-in-out ${Math.random() * 4}s infinite`;
    layer.appendChild(s);
  }
}

/* ------------------------------------------------------------------ */
/*  THEME                                                              */
/* ------------------------------------------------------------------ */
function applyTheme() {
  const key = window.CCPOS_THEME_KEY || "ccpos_theme";
  const theme = localStorage.getItem(key) || "light";
  document.body.classList.toggle("dark", theme === "dark");
  const btn = $("#themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}

/* ------------------------------------------------------------------ */
/*  ROUTER + MASTER RENDER                                             */
/* ------------------------------------------------------------------ */
const router = {
  navigate(view) {
    state.view = view;
    render();
  }
};

const PROTECTED = ["favorites", "history", "tracking", "console"];

function render() {
  const main = $("#appMain");
  if (!main) return;

  if (PROTECTED.includes(state.view) && !state.user) {
    state.view = "auth";
    state.authView = "login";
  }
  if (state.view === "console" && state.user && !["staff", "admin"].includes(state.user.role)) {
    state.view = "home";
  }

  switch (state.view) {
    case "home": main.innerHTML = viewHome(); break;
    case "menu": main.innerHTML = viewMenu(); break;
    case "auth": main.innerHTML = viewAuth(); break;
    case "favorites": main.innerHTML = viewFavorites(); break;
    case "history": main.innerHTML = viewHistory(); break;
    case "tracking": main.innerHTML = viewTracking(); break;
    case "console": main.innerHTML = viewConsole(); break;
    default: main.innerHTML = viewHome();
  }

  renderNav();
  renderCart();
  updateCartBadge();
  animateCards();
}

function animateCards() {
  $$(".card").forEach((c, i) => {
    c.style.animationDelay = Math.min(i * 45, 500) + "ms";
  });
}

/* ------------------------------------------------------------------ */
/*  NAVBAR                                                             */
/* ------------------------------------------------------------------ */
function renderNav() {
  const btn = $("#userBtn");
  if (!btn) return;

  if (state.user) {
    btn.innerHTML = `👤 ${esc(state.user.name.split(" ")[0])}`;
    btn.onclick = () => app.toggleUserMenu();
  } else {
    btn.innerHTML = "Sign In";
    btn.onclick = () => app.goto("auth", "login");
  }

  // Show console shortcut for staff/admin
  let shortcut = $("#consoleShortcut");
  if (state.user && ["staff", "admin"].includes(state.user.role)) {
    if (!shortcut) {
      shortcut = document.createElement("button");
      shortcut.id = "consoleShortcut";
      shortcut.className = "nav-btn";
      shortcut.textContent = state.user.role === "admin" ? "🛡️ Console" : "👨‍🍳 Console";
      shortcut.onclick = () => app.goto("console");
      $("#navActions").insertBefore(shortcut, btn);
    } else {
      shortcut.style.display = "";
      shortcut.textContent = state.user.role === "admin" ? "🛡️ Console" : "👨‍🍳 Console";
    }
  } else if (shortcut) {
    shortcut.style.display = "none";
  }
}

/* ------------------------------------------------------------------ */
/*  AUTH VIEW                                                          */
/* ------------------------------------------------------------------ */
function viewAuth() {
  const isCustomer = state.authTab === "customer";
  return `
  <section class="auth-page">
    <aside class="auth-aside">
      <span class="hero-badge">🍱 CCPOS · Campus Cafeteria</span>
      <h1>Good food.<br/><span class="accent">Zero queue.</span></h1>
      <p>Pre-order from today's canteen menu and pick up hot food on your schedule. Built for students, faculty and guests — with dedicated staff &amp; admin tools.</p>
      <div class="role-cards">
        <div class="role-card"><div class="rc-emoji">🎓</div><div class="rc-title">Students</div><div class="rc-desc">Order, track &amp; save favorites</div></div>
        <div class="role-card"><div class="rc-emoji">👩‍🏫</div><div class="rc-title">Faculty</div><div class="rc-desc">Priority pickup + 10% off</div></div>
        <div class="role-card"><div class="rc-emoji">🧑‍🤝‍🧑</div><div class="rc-title">Guests</div><div class="rc-desc">Parents &amp; visitors welcome</div></div>
        <div class="role-card"><div class="rc-emoji">👨‍🍳</div><div class="rc-title">Staff &amp; Admin</div><div class="rc-desc">Manage menu &amp; staff</div></div>
      </div>
    </aside>

    <div class="auth-card">
      <div class="auth-card-inner">
        <div style="display:flex;justify-content:flex-end;margin-bottom:2px">
          <span class="mode-badge ${Store.mode === "local" ? "local" : "live"}">${Store.mode === "local" ? "● Demo mode" : "● Supabase live"}</span>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab ${isCustomer ? "active" : ""}" onclick="app.setAuthTab('customer')">🎓 Campus Login</button>
          <button class="auth-tab ${!isCustomer ? "active" : ""}" onclick="app.setAuthTab('staff')">👨‍🍳 Staff / Admin</button>
        </div>
        ${isCustomer ? authCustomerForm() : authStaffForm()}
        ${Store.mode === "local" ? demoLogins() : `
          <div class="auth-note">Connected to Supabase. New here? Students, faculty and guests can create an account. Staff/admin accounts are provisioned by an administrator.</div>
        `}
      </div>
    </div>
  </section>`;
}

function authCustomerForm() {
  if (state.authView === "signup") {
    return `
      <h2>Create your account</h2>
      <p class="auth-sub">Students, faculty and guests — all welcome.</p>
      <form class="auth-form" onsubmit="app.doSignup(event)">
        <div class="field"><label>Full name</label><input id="suName" placeholder="e.g. Aarav Sharma" required/></div>
        <div class="field"><label>Email</label><input id="suEmail" type="email" placeholder="you@campus.edu" required/></div>
        <div class="field"><label>Password</label><input id="suPass" type="password" minlength="6" placeholder="At least 6 characters" required/></div>
        <div class="field"><label>I am a…</label>
          <select id="suRole">
            <option value="student">🎓 Student</option>
            <option value="faculty">👩‍🏫 Faculty</option>
            <option value="guest">🧑‍🤝‍🧑 Guest (parent / visitor)</option>
          </select>
        </div>
        <button class="btn btn-primary btn-full" type="submit">Create account →</button>
      </form>
      <div class="auth-switch">Already have an account? <button onclick="app.setAuthView('login')">Sign in</button></div>`;
  }
  return `
    <h2>Welcome back 👋</h2>
    <p class="auth-sub">Sign in to order, track and reorder your favourites.</p>
    <form class="auth-form" onsubmit="app.doLogin(event)">
      <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@campus.edu" required/></div>
      <div class="field"><label>Password</label><input id="authPass" type="password" placeholder="••••••" required/></div>
      <button class="btn btn-primary btn-full" type="submit">Sign in →</button>
    </form>
    <div class="auth-switch">New to CCPOS? <button onclick="app.setAuthView('signup')">Create an account</button></div>
    <div class="auth-switch" style="margin-top:6px"><button onclick="app.goto('menu')">Just browsing? Explore the menu →</button></div>`;
}

function authStaffForm() {
  return `
    <h2>Staff &amp; Admin access 👨‍🍳</h2>
    <p class="auth-sub">Sign in to manage the menu, orders and staff.</p>
    <form class="auth-form" onsubmit="app.doLogin(event)">
      <div class="field"><label>Work email</label><input id="authEmail" type="email" placeholder="staff@campus.edu" required/></div>
      <div class="field"><label>Password</label><input id="authPass" type="password" placeholder="••••••" required/></div>
      <button class="btn btn-primary btn-full" type="submit">Sign in →</button>
    </form>
    <div class="auth-note">
      Staff and admin accounts are created by an administrator from the Admin Console.
      ${Store.mode === "local" ? "In demo mode, use the quick logins below." : ""}
    </div>`;
}

function demoLogins() {
  return `
    <div class="demo-logins">
      <div class="dl-title">Quick demo logins</div>
      <div class="demo-chips">
        ${["student", "faculty", "guest", "staff", "admin"].map((r) =>
          `<button class="demo-chip" onclick="app.demoLogin('${r}')">${ROLE_META[r].emoji} ${ROLE_META[r].label}</button>`
        ).join("")}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: HOME                                                         */
/* ------------------------------------------------------------------ */
function viewHome() {
  const featured = state.menu.filter((m) => m.badge).slice(0, 4);
  const popular = [...state.menu].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const greeting = state.user
    ? `<span class="hero-badge">${ROLE_META[state.user.role].emoji} Welcome back, ${esc(state.user.name.split(" ")[0])} ${roleBadge(state.user.role)}</span>`
    : `<span class="hero-badge">⚡ Skip the queue · Order ahead</span>`;

  return `
  <section class="hero">
    ${greeting}
    <h1>Your campus canteen,<br><span class="accent">ready when you are.</span></h1>
    <p>Browse today's menu, pre-order your favourites and pay ahead. Pick up hot food without the lunch-hour rush.</p>
    <div class="hero-actions">
      <button class="btn btn-primary" onclick="app.goto('menu')">🍽️ Browse Menu</button>
      ${state.user
        ? `<button class="btn btn-ghost" onclick="app.goto('history')">📜 My Orders</button>`
        : `<button class="btn btn-ghost" onclick="app.goto('auth','login')">🔐 Sign In</button>`}
    </div>
    <div class="category-row">
      ${CATEGORIES.map((c) => `<button class="chip ${state.category === c ? "active" : ""}" onclick="app.setCategory('${c}', true)">${c}</button>`).join("")}
    </div>
  </section>

  <section class="section">
    <div class="section-header">
      <h2>⭐ Today's Specials</h2>
      <a class="view-all" onclick="app.goto('menu')">View full menu →</a>
    </div>
    <div class="grid">${featured.map(menuCard).join("")}</div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="section-header">
      <h2>🔥 Most Loved</h2>
      <a class="view-all" onclick="app.goto('menu')">See all →</a>
    </div>
    <div class="grid">${popular.map(menuCard).join("")}</div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="kpi-row" style="max-width:1000px;margin:0 auto">
      <div class="kpi"><div class="kpi-mark green">🚀</div><div><div class="kpi-val">0 min</div><div class="kpi-label">Average queue time</div></div></div>
      <div class="kpi"><div class="kpi-mark amber">💸</div><div><div class="kpi-val">12%</div><div class="kpi-label">Less food waste</div></div></div>
      <div class="kpi"><div class="kpi-mark red">🍱</div><div><div class="kpi-val">${state.menu.length}</div><div class="kpi-label">Menu items today</div></div></div>
      <div class="kpi"><div class="kpi-mark green">⏱</div><div><div class="kpi-val">10 min</div><div class="kpi-label">Avg prep time</div></div></div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/*  MENU CARD                                                          */
/* ------------------------------------------------------------------ */
function menuCard(item) {
  const fav = state.favorites.includes(item.id);
  const dietIcon = item.dietary === "Non-Veg" ? "🔴" : item.dietary === "Vegan" ? "🌱" : "🟢";
  const soldout = !item.available;
  return `
    <article class="card ${soldout ? "soldout" : ""}">
      <div class="card-image">
        ${item.image
          ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.style.display='none'"/>`
          : `<div class="card-emoji">${item.emoji || "🍽️"}</div>`}
        ${item.badge ? `<span class="card-badge">${esc(item.badge)}</span>` : ""}
        <span class="card-badge ${soldout ? "soldout" : "available"}" style="left:auto;right:10px">${soldout ? "Sold Out" : "Available"}</span>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${dietIcon} ${esc(item.dietary)}</span>
          <span>⏱ ${item.prepTime} min</span>
          <span>⭐ ${Number(item.rating).toFixed(1)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
          <h3 class="card-title">${esc(item.name)}</h3>
          <button class="fav-btn" data-fav="${item.id}" title="Favorite" style="font-size:1.2rem;line-height:1">${fav ? "❤️" : "🤍"}</button>
        </div>
        <p class="card-desc">${esc(item.desc)}</p>
        <div class="card-footer">
          <span class="card-price">${money(item.price)}</span>
          <button class="card-add" data-add="${item.id}" ${soldout ? "disabled" : ""} title="${soldout ? "Sold out" : "Add to cart"}">＋</button>
        </div>
      </div>
    </article>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: MENU                                                         */
/* ------------------------------------------------------------------ */
function filteredMenu() {
  let items = [...state.menu];
  if (state.category !== "All") items = items.filter((m) => m.category === state.category);
  if (state.dietary !== "All") items = items.filter((m) => m.dietary === state.dietary);
  if (state.search) {
    const q = state.search.toLowerCase();
    items = items.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      (m.desc || "").toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }
  return items;
}

function viewMenu() {
  const items = filteredMenu();
  return `
  <section class="section" style="padding-top:104px">
    <div class="section-header">
      <div>
        <h2>Today's Menu</h2>
        <p style="color:var(--muted);font-size:0.9rem;margin-top:4px">${items.length} item${items.length !== 1 ? "s" : ""} · fresh from the canteen</p>
      </div>
      <select id="dietarySelect" class="chip" style="padding:8px 12px" onchange="app.setDietary(this.value)">
        ${DIETARY.map((d) => `<option value="${d}" ${state.dietary === d ? "selected" : ""}>${d === "All" ? "All diets" : d}</option>`).join("")}
      </select>
    </div>

    <div class="mobile-search">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search menu…" value="${esc(state.search)}" oninput="app.mobileSearch(this.value)"/>
      </div>
    </div>

    <div class="category-row" style="justify-content:flex-start;margin:0 0 28px">
      ${CATEGORIES.map((c) => `<button class="chip ${state.category === c ? "active" : ""}" onclick="app.setCategory('${c}')">${c}</button>`).join("")}
    </div>

    ${items.length === 0 ? `
      <div class="empty">
        <span class="empty-sticker">🕵️</span>
        <h3>Nothing matches that search</h3>
        <p>Try a different keyword, category or dietary filter.</p>
        <button class="btn btn-primary" onclick="app.resetFilters()">Clear filters</button>
      </div>` : `<div class="grid">${items.map(menuCard).join("")}</div>`}
  </section>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: FAVORITES                                                    */
/* ------------------------------------------------------------------ */
function viewFavorites() {
  const favs = state.menu.filter((m) => state.favorites.includes(m.id));
  return `
  <section class="section" style="padding-top:104px">
    <div class="section-header"><h2>❤️ Your Favorites</h2></div>
    ${favs.length === 0 ? `
      <div class="empty">
        <span class="empty-sticker">💔</span>
        <h3>No favorites yet</h3>
        <p>Tap the heart on any dish to save it here for quick ordering.</p>
        <button class="btn btn-primary" onclick="app.goto('menu')">Browse menu</button>
      </div>` : `<div class="grid">${favs.map(menuCard).join("")}</div>`}
  </section>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: ORDER HISTORY                                                */
/* ------------------------------------------------------------------ */
function viewHistory() {
  const orders = state.orders;
  return `
  <section class="section" style="padding-top:104px;max-width:900px;margin:0 auto">
    <div class="section-header"><h2>📜 Order History</h2></div>
    ${orders.length === 0 ? `
      <div class="empty">
        <span class="empty-sticker">🧾</span>
        <h3>No orders yet</h3>
        <p>Your pre-orders and their status will appear here.</p>
        <button class="btn btn-primary" onclick="app.goto('menu')">Order something</button>
      </div>` : orders.map((o) => orderCard(o, true)).join("")}
  </section>`;
}

function orderCard(o, showReorder) {
  const itemsText = o.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
  return `
    <div class="order-card">
      <div class="order-info">
        <h4>Order #${o.id.slice(-6).toUpperCase()}</h4>
        <div class="order-meta">${new Date(o.createdAt).toLocaleString()} · Pickup ${esc(o.slot)}</div>
        <div class="order-items">${esc(itemsText)}</div>
        <div class="order-total">Total: ${money(o.total)}</div>
        <div style="margin-top:10px"><span class="status ${o.status}">${statusLabel(o.status)}</span></div>
      </div>
      <div class="order-actions">
        ${showReorder && o.status === "completed" ? `<button class="btn btn-ghost" onclick="app.reorder('${o.id}')">🔁 Re-order</button>` : ""}
        ${o.status !== "completed" && o.status !== "cancelled" ? `<button class="btn btn-primary" onclick="app.viewOrder('${o.id}')">Track</button>` : ""}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: TRACKING                                                     */
/* ------------------------------------------------------------------ */
function viewTracking() {
  const order = state.orders.find((o) => o.id === state.trackingId);
  if (!order) {
    return `
    <section class="section" style="padding-top:120px">
      <div class="empty">
        <span class="empty-sticker">🔎</span>
        <h3>Order not found</h3>
        <p>We couldn't find that order in your history.</p>
        <button class="btn btn-primary" onclick="app.goto('history')">Back to history</button>
      </div>
    </section>`;
  }

  const steps = [
    { key: "placed", label: "Order Placed", icon: "📝" },
    { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
    { key: "ready", label: "Ready for Pickup", icon: "🔔" },
    { key: "completed", label: "Picked Up", icon: "🎉" }
  ];
  const orderFlow = ["placed", "preparing", "ready", "completed"];
  const currentIdx = Math.max(0, orderFlow.indexOf(order.status));

  return `
  <section class="section" style="padding-top:104px;max-width:760px;margin:0 auto">
    <div class="section-header"><h2>📍 Track Your Order</h2></div>
    <div class="staff-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:24px">
        <div>
          <h4 style="margin:0">Order #${order.id.slice(-6).toUpperCase()}</h4>
          <div class="order-meta">Pickup slot: ${esc(order.slot)}</div>
        </div>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>

      <div class="tracker">
        ${steps.map((s, i) => `
          <div class="track-step ${i <= currentIdx ? "done" : ""} ${i === currentIdx ? "current" : ""}">
            <div class="track-dot">${i <= currentIdx ? "✓" : s.icon}</div>
            <div class="track-text">${s.label}</div>
          </div>
          ${i < steps.length - 1 ? `<div class="track-line ${i < currentIdx ? "done" : ""}"></div>` : ""}
        `).join("")}
      </div>

      <div style="margin-top:28px">
        ${order.items.map((i) => `
          <div class="cart-item">
            <div class="cart-item-img">${i.emoji || "🍽️"}</div>
            <div class="cart-item-info">
              <div class="cart-item-name">${esc(i.name)}</div>
              <div class="cart-item-meta">×${i.qty} · ${esc(i.dietary)}</div>
            </div>
            <div class="cart-item-price">${money(i.price * i.qty)}</div>
          </div>`).join("")}
        <div class="cart-total-row" style="margin-top:12px"><span class="label">Total Paid</span><span>${money(order.total)}</span></div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="app.goto('history')">← Back to history</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print receipt</button>
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/*  VIEW: CONSOLE (staff + admin)                                      */
/* ------------------------------------------------------------------ */
function consoleTabs() {
  if (!state.user) return [];
  if (state.user.role === "admin") {
    return [
      ["overview", "📊 Overview"],
      ["staff", "👥 Staff"],
      ["menu", "🍽️ Menu"],
      ["orders", "📋 Orders"],
      ["analytics", "📈 Analytics"]
    ];
  }
  return [
    ["orders", "📋 Orders"],
    ["menu", "🍽️ Menu"]
  ];
}

function viewConsole() {
  if (!state.user || !["staff", "admin"].includes(state.user.role)) return viewAuth();
  const tabs = consoleTabs();
  if (!tabs.some(([k]) => k === state.consoleTab)) state.consoleTab = tabs[0][0];

  const initials = state.user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return `
  <div class="console-layout">
    <aside class="console-sidebar">
      <div class="cs-user">
        <div class="cs-avatar">${initials}</div>
        <div>
          <div class="cs-name">${esc(state.user.name)}</div>
          <div class="cs-email">${esc(state.user.email)}</div>
        </div>
      </div>
      <h4>${state.user.role === "admin" ? "Administration" : "Canteen"}</h4>
      ${tabs.map(([k, l]) => `
        <button class="console-nav-item ${state.consoleTab === k ? "active" : ""}" onclick="app.consoleTab('${k}')">${l}</button>
      `).join("")}
      <div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--line)">
        <button class="console-nav-item" onclick="app.logout()">🚪 Sign out</button>
      </div>
    </aside>
    <div class="console-main" id="consoleMain">
      ${state.consoleTab === "overview" ? consoleOverview() :
        state.consoleTab === "staff" ? consoleStaff() :
        state.consoleTab === "menu" ? consoleMenu() :
        state.consoleTab === "orders" ? consoleOrders() :
        consoleAnalytics()}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  CONSOLE: OVERVIEW (admin)                                          */
/* ------------------------------------------------------------------ */
function consoleOverview() {
  const today = new Date().toDateString();
  const todays = state.orders.filter((o) => new Date(o.createdAt).toDateString() === today && o.status !== "cancelled");
  const revenue = todays.reduce((s, o) => s + o.total, 0);
  const activeOrders = state.orders.filter((o) => ["placed", "preparing", "ready"].includes(o.status)).length;
  const staffCount = state.users.filter((u) => u.role === "staff" && u.active).length;

  return `
    <div class="console-head">
      <div>
        <h2>Welcome, ${esc(state.user.name.split(" ")[0])} 🛡️</h2>
        <p>Admin overview · ${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <button class="btn btn-primary" onclick="app.openAddStaff()">＋ Add Staff</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-mark green">💰</div><div><div class="kpi-val">${money(revenue)}</div><div class="kpi-label">Today's revenue</div></div></div>
      <div class="kpi"><div class="kpi-mark amber">🧾</div><div><div class="kpi-val">${todays.length}</div><div class="kpi-label">Orders today</div></div></div>
      <div class="kpi"><div class="kpi-mark red">⏳</div><div><div class="kpi-val">${activeOrders}</div><div class="kpi-label">Active orders</div></div></div>
      <div class="kpi"><div class="kpi-mark">👥</div><div><div class="kpi-val">${staffCount}</div><div class="kpi-label">Active staff</div></div></div>
    </div>

    <div class="kpi-row" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <button class="staff-card" style="text-align:left;cursor:pointer" onclick="app.consoleTab('staff')">
        <div style="font-size:1.6rem">👥</div><h4 style="margin:8px 0 2px">Manage Staff</h4>
        <p style="color:var(--muted);font-size:0.82rem">Add, promote or deactivate staff accounts.</p>
      </button>
      <button class="staff-card" style="text-align:left;cursor:pointer" onclick="app.consoleTab('menu')">
        <div style="font-size:1.6rem">🍽️</div><h4 style="margin:8px 0 2px">Manage Menu</h4>
        <p style="color:var(--muted);font-size:0.82rem">Update dishes, prices and availability.</p>
      </button>
      <button class="staff-card" style="text-align:left;cursor:pointer" onclick="app.consoleTab('analytics')">
        <div style="font-size:1.6rem">📈</div><h4 style="margin:8px 0 2px">Analytics</h4>
        <p style="color:var(--muted);font-size:0.82rem">Top sellers, revenue and wastage insights.</p>
      </button>
    </div>

    <div class="staff-card">
      <h4>🧾 Recent Orders</h4>
      ${state.orders.length === 0 ? `<div class="console-empty"><span class="ce-emoji">🍽️</span><p>No orders yet today.</p></div>` :
        state.orders.slice(0, 5).map((o) => `
          <div class="order-card" style="margin-bottom:10px">
            <div class="order-info">
              <h4>#${o.id.slice(-6).toUpperCase()} <span class="status ${o.status}" style="margin-left:8px">${statusLabel(o.status)}</span></h4>
              <div class="order-meta">${esc(o.studentName)} · ${new Date(o.createdAt).toLocaleTimeString()}</div>
            </div>
            <div class="order-total">${money(o.total)}</div>
          </div>`).join("")}
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  CONSOLE: STAFF MANAGEMENT (admin)                                  */
/* ------------------------------------------------------------------ */
function consoleStaff() {
  const staff = state.users.filter((u) => ["staff", "admin"].includes(u.role));
  const filtered = staff.filter((u) => {
    const q = state.staffSearch.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = state.staffRoleFilter === "all" || u.role === state.staffRoleFilter;
    return matchesSearch && matchesRole;
  });

  return `
    <div class="console-head">
      <div>
        <h2>Staff Management</h2>
        <p>Create and manage staff &amp; admin accounts.</p>
      </div>
      <button class="btn btn-primary" onclick="app.openAddStaff()">＋ Add Staff</button>
    </div>

    <div class="toolbar">
      <input id="staffSearchInput" placeholder="Search by name or email…" value="${esc(state.staffSearch)}" oninput="app.filterStaff(this.value)"/>
      <select onchange="app.setStaffRoleFilter(this.value)">
        <option value="all" ${state.staffRoleFilter === "all" ? "selected" : ""}>All roles</option>
        <option value="staff" ${state.staffRoleFilter === "staff" ? "selected" : ""}>Staff only</option>
        <option value="admin" ${state.staffRoleFilter === "admin" ? "selected" : ""}>Admins only</option>
      </select>
    </div>

    <div class="staff-card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No staff found.</td></tr>` :
              filtered.map((u) => `
                <tr>
                  <td><strong>${esc(u.name)}</strong>${u.id === state.user.id ? ' <span style="color:var(--brand);font-size:0.7rem">(you)</span>' : ""}</td>
                  <td>${esc(u.email)}</td>
                  <td>
                    <select onchange="app.changeUserRole('${u.id}', this.value)" ${u.id === state.user.id ? "disabled" : ""} style="height:32px;padding:0 8px;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--ink)">
                      <option value="staff" ${u.role === "staff" ? "selected" : ""}>Staff</option>
                      <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                  </td>
                  <td><span class="status ${u.active ? "ready" : "cancelled"}">${u.active ? "Active" : "Disabled"}</span></td>
                  <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <div class="action-group">
                      <button class="mini-btn" onclick="app.toggleUserActive('${u.id}')" ${u.id === state.user.id ? "disabled" : ""}>
                        ${u.active ? "Disable" : "Enable"}
                      </button>
                      <button class="mini-btn danger" onclick="app.deleteUser('${u.id}')" ${u.id === state.user.id ? "disabled" : ""}>Delete</button>
                    </div>
                  </td>
                </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="staff-card" style="background:var(--glass)">
      <h4>🔐 Account provisioning</h4>
      <p style="color:var(--muted);font-size:0.85rem;line-height:1.6">
        ${Store.mode === "local"
          ? "Demo mode: “Add Staff” creates accounts instantly and they appear above."
          : "Live mode: “Add Staff” uses the secure <code>admin-users</code> Edge Function (service role) to create the account. Ask your developer/admin to deploy it once."}
        Staff sign in from the <strong>Staff / Admin</strong> tab on the login page.
      </p>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  CONSOLE: MENU MANAGER                                              */
/* ------------------------------------------------------------------ */
function consoleMenu() {
  return `
    <div class="console-head">
      <div><h2>Menu Manager</h2><p>Add dishes, set prices and control availability.</p></div>
    </div>

    <div class="staff-card">
      <h4>➕ Add / Edit item</h4>
      <form onsubmit="app.saveMenuItem(event)">
        <div class="menu-form">
          <div><label>Name</label><input id="miName" required placeholder="e.g. Veg Pulao"/></div>
          <div><label>Price (₹)</label><input id="miPrice" type="number" min="1" required placeholder="80"/></div>
          <div><label>Category</label>
            <select id="miCategory">${CATEGORIES.filter((c) => c !== "All").map((c) => `<option>${c}</option>`).join("")}</select>
          </div>
          <div><label>Dietary</label>
            <select id="miDietary">${DIETARY.filter((d) => d !== "All").map((d) => `<option>${d}</option>`).join("")}</select>
          </div>
          <div><label>Emoji</label><input id="miEmoji" maxlength="4" value="🍲"/></div>
          <div><label>Prep time (min)</label><input id="miPrep" type="number" min="1" value="10"/></div>
          <div class="menu-form full"><label>Description</label><textarea id="miDesc" placeholder="Short description…"></textarea></div>
          <div><label>Image URL (optional)</label><input id="miImage" placeholder="https://…"/></div>
          <div><label>Availability</label>
            <select id="miAvailable"><option value="true">Available</option><option value="false">Sold out</option></select>
          </div>
        </div>
        <input type="hidden" id="miEditId" value=""/>
        <button class="btn btn-primary" type="submit">Save item</button>
        <button class="btn btn-ghost" type="button" onclick="app.resetMenuForm()">Clear</button>
      </form>
    </div>

    <div class="staff-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px"><h4 style="margin:0">🍽️ All items (${state.menu.length})</h4></div>
      <div class="table-wrap" style="border:none;border-radius:0;border-top:1px solid var(--line)">
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Diet</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${state.menu.map((m) => `
              <tr>
                <td>${m.emoji} <strong>${esc(m.name)}</strong></td>
                <td>${esc(m.category)}</td>
                <td>${money(m.price)}</td>
                <td>${esc(m.dietary)}</td>
                <td><span class="status ${m.available ? "ready" : "cancelled"}">${m.available ? "Available" : "Sold out"}</span></td>
                <td>
                  <div class="action-group">
                    <button class="mini-btn" onclick="app.toggleAvailability('${m.id}')">${m.available ? "Sold out" : "Restock"}</button>
                    <button class="mini-btn" onclick="app.editMenuItem('${m.id}')">Edit</button>
                    <button class="mini-btn danger" onclick="app.deleteMenuItem('${m.id}')">Delete</button>
                  </div>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  CONSOLE: ORDERS                                                    */
/* ------------------------------------------------------------------ */
function consoleOrders() {
  const active = state.orders.filter((o) => ["placed", "preparing", "ready"].includes(o.status));
  const done = state.orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  return `
    <div class="console-head">
      <div><h2>Order Board</h2><p>Live orders — update their status as you fulfil them.</p></div>
      <button class="btn btn-ghost" onclick="app.reload()">⟳ Refresh</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-mark amber">🕐</div><div><div class="kpi-val">${state.orders.filter((o) => o.status === "placed").length}</div><div class="kpi-label">New orders</div></div></div>
      <div class="kpi"><div class="kpi-mark red">👨‍🍳</div><div><div class="kpi-val">${state.orders.filter((o) => o.status === "preparing").length}</div><div class="kpi-label">Preparing</div></div></div>
      <div class="kpi"><div class="kpi-mark green">✅</div><div><div class="kpi-val">${state.orders.filter((o) => o.status === "ready").length}</div><div class="kpi-label">Ready for pickup</div></div></div>
      <div class="kpi"><div class="kpi-mark">📦</div><div><div class="kpi-val">${done.length}</div><div class="kpi-label">Completed</div></div></div>
    </div>

    <div class="staff-card">
      <h4>🔴 Active orders</h4>
      ${active.length === 0 ? `<div class="console-empty"><span class="ce-emoji">🎉</span><p>All caught up — no active orders!</p></div>` : active.map(consoleOrderRow).join("")}
    </div>

    <div class="staff-card">
      <h4>✅ Completed / cancelled</h4>
      ${done.length === 0 ? `<p style="color:var(--muted)">Nothing here yet.</p>` : done.slice(0, 12).map(consoleOrderRow).join("")}
    </div>`;
}

function consoleOrderRow(o) {
  const nextStatus = { placed: "preparing", preparing: "ready", ready: "completed" }[o.status];
  const nextLabel = { placed: "Start Preparing", preparing: "Mark Ready", ready: "Mark Picked Up" }[o.status];
  return `
    <div class="order-card">
      <div class="order-info">
        <h4>#${o.id.slice(-6).toUpperCase()} <span class="status ${o.status}" style="margin-left:8px">${statusLabel(o.status)}</span></h4>
        <div class="order-meta">${esc(o.studentName)} ${roleBadge(o.role)} · Pickup ${esc(o.slot)}</div>
        <div class="order-items">${o.items.map((i) => `${esc(i.name)} ×${i.qty}`).join(", ")}</div>
        <div class="order-total">${money(o.total)} · ${esc(o.payment)}</div>
      </div>
      <div class="order-actions">
        ${nextStatus ? `<button class="btn btn-primary" onclick="app.advanceOrder('${o.id}')">${nextLabel} →</button>` : ""}
        ${!["completed", "cancelled"].includes(o.status) ? `<button class="btn btn-ghost" onclick="app.cancelOrder('${o.id}')">Cancel</button>` : ""}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  CONSOLE: ANALYTICS                                                 */
/* ------------------------------------------------------------------ */
function consoleAnalytics() {
  const orders = state.orders.filter((o) => o.status !== "cancelled");
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const counts = {};
  orders.forEach((o) => o.items.forEach((i) => { counts[i.name] = (counts[i.name] || 0) + i.qty; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top.length ? top[0][1] : 1;
  const soldOut = state.menu.filter((m) => !m.available).length;

  return `
    <div class="console-head"><div><h2>Analytics</h2><p>Sales, popular dishes and wastage insights.</p></div></div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-mark green">💰</div><div><div class="kpi-val">${money(revenue)}</div><div class="kpi-label">Total revenue</div></div></div>
      <div class="kpi"><div class="kpi-mark amber">🧾</div><div><div class="kpi-val">${orders.length}</div><div class="kpi-label">Total orders</div></div></div>
      <div class="kpi"><div class="kpi-mark red">🍽️</div><div><div class="kpi-val">${orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0)}</div><div class="kpi-label">Items sold</div></div></div>
      <div class="kpi"><div class="kpi-mark">📉</div><div><div class="kpi-val">${soldOut}</div><div class="kpi-label">Sold-out items</div></div></div>
    </div>

    <div class="staff-card">
      <h4>🏆 Top selling items</h4>
      ${top.length === 0 ? `<p style="color:var(--muted)">No sales data yet.</p>` : top.map(([name, qty], i) => `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:700;margin-bottom:6px">
            <span>${i + 1}. ${esc(name)}</span><span>${qty} sold</span>
          </div>
          <div style="height:10px;background:var(--line);border-radius:100px;overflow:hidden">
            <div style="height:100%;width:${(qty / max) * 100}%;background:linear-gradient(90deg,var(--brand),var(--amber));border-radius:100px;transition:width 600ms ease"></div>
          </div>
        </div>`).join("")}
    </div>

    <div class="staff-card">
      <h4>🗑️ Wastage estimate</h4>
      <p style="color:var(--muted);font-size:0.9rem;line-height:1.6">
        Pre-ordering lets the kitchen cook to demand. Currently <strong>${soldOut}</strong> item(s) are sold out,
        meaning less unsold stock at closing time. Estimated waste reduction: <strong style="color:var(--green-dark)">~12%</strong>.
      </p>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  CART DRAWER                                                        */
/* ------------------------------------------------------------------ */
function renderCart() {
  const body = $("#cartBody");
  const footer = $("#cartFooter");
  if (!body || !footer) return;

  if (state.cart.length === 0) {
    body.innerHTML = `<div class="cart-empty-msg"><span class="sticker-text">🛒</span>Your cart is empty.<br/><small>Add something delicious!</small></div>`;
    footer.innerHTML = `<button class="btn btn-ghost btn-full" onclick="app.goto('menu');app.closeCart()">Browse Menu</button>`;
    return;
  }

  if (state.checkoutStep === "cart") {
    body.innerHTML = state.cart.map((c) => {
      const item = itemById(c.id);
      if (!item) return "";
      return `
        <div class="cart-item">
          <div class="cart-item-img">${item.emoji || "🍽️"}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${esc(item.name)}</div>
            <div class="cart-item-meta"><span>${money(item.price)}</span><span>·</span><span>⏱ ${item.prepTime}m</span></div>
            <div class="cart-item-qty">
              <button class="qty-btn" onclick="app.changeQty('${item.id}',-1)">−</button>
              <span class="qty-val">${c.qty}</span>
              <button class="qty-btn" onclick="app.changeQty('${item.id}',1)">+</button>
              <button class="remove-item" onclick="app.removeFromCart('${item.id}')">Remove</button>
            </div>
          </div>
          <div class="cart-item-price">${money(item.price * c.qty)}</div>
        </div>`;
    }).join("");

    footer.innerHTML = `
      <div class="cart-total-row"><span class="label">Subtotal (${cartCount()} items)</span><span>${money(cartSubtotal())}</span></div>
      ${discountRate() > 0 ? `<div class="cart-total-row"><span class="label discount-line">👩‍🏫 Faculty discount (10%)</span><span class="discount-line">−${money(cartSubtotal() * discountRate())}</span></div>` : ""}
      <div class="cart-total-row"><span class="label">Platform fee</span><span>${money(cartFee())}</span></div>
      <div class="cart-total-row" style="font-size:1.25rem"><span class="label" style="color:var(--ink)">Total</span><span>${money(cartTotal())}</span></div>
      <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="app.goCheckout()">Proceed to checkout →</button>`;
  } else {
    body.innerHTML = `
      <div class="checkout-form">
        <div class="field"><label>Your name</label><input id="coName" placeholder="Full name" value="${esc(state.user?.name || "")}"/></div>
        <div class="field"><label>Pickup time slot</label>
          <div class="slot-row">
            ${SLOTS.map((s) => `<button class="slot-btn ${state.selectedSlot === s ? "selected" : ""}" onclick="app.selectSlot('${s}')">${s}</button>`).join("")}
          </div>
        </div>
        <div class="field"><label>Payment method</label>
          <div class="payment-row">
            ${["Card", "UPI", "Cash"].map((p) => `<button class="pay-chip ${state.paymentMethod === p ? "selected" : ""}" onclick="app.selectPayment('${p}')">${p === "Card" ? "💳" : p === "UPI" ? "📱" : "💵"} ${p}</button>`).join("")}
          </div>
        </div>
      </div>
      ${discountRate() > 0 ? `<div class="cart-total-row"><span class="label discount-line">Faculty discount</span><span class="discount-line">−${money(cartSubtotal() * discountRate())}</span></div>` : ""}
      <div class="cart-total-row"><span class="label">Total to pay</span><span>${money(cartTotal())}</span></div>
    `;
    footer.innerHTML = `
      <button class="btn btn-ghost btn-full" style="margin-bottom:8px" onclick="app.backToCart()">← Back to cart</button>
      <button class="btn btn-primary btn-full" onclick="app.placeOrder()">Pay ${money(cartTotal())} & Pre-order</button>`;
  }
}

function updateCartBadge() {
  const badge = $("#cartBadge");
  if (!badge) return;
  const n = cartCount();
  badge.textContent = n;
  badge.style.display = n > 0 ? "grid" : "none";
  if (n > 0) {
    badge.style.animation = "none";
    void badge.offsetWidth;
    badge.style.animation = "badgePop 250ms cubic-bezier(0.34,1.56,0.64,1)";
  }
}

/* ------------------------------------------------------------------ */
/*  MODALS                                                             */
/* ------------------------------------------------------------------ */
function openModal(title, bodyHtml, footerHtml = "") {
  $("#genericModalTitle").textContent = title;
  $("#genericModalBody").innerHTML = bodyHtml;
  $("#genericModalFooter").innerHTML = footerHtml;
  $("#genericModal").style.display = "flex";
}
function closeModal() {
  $("#genericModal").style.display = "none";
}

/* ------------------------------------------------------------------ */
/*  APP ACTIONS                                                        */
/* ------------------------------------------------------------------ */
const app = {
  /* -------------------- init / data -------------------- */
  async init() {
    applyTheme();
    initStickers();
    bindGlobalEvents();
    try {
      state.user = await Store.init();
    } catch (e) {
      console.error(e);
      toast(e.message || "Could not initialise.", "error");
    }
    await app.refresh();
    render();

    // Local demo: gently auto-advance the current user's order so tracking feels live
    if (Store.mode === "local") {
      setInterval(async () => {
        if (!state.user || !["student", "faculty", "guest"].includes(state.user.role)) return;
        const active = state.orders.find((o) => ["placed", "preparing"].includes(o.status));
        if (active) {
          const next = active.status === "placed" ? "preparing" : "ready";
          try {
            await Store.updateOrderStatus(active.id, next);
            await app.refresh();
            render();
          } catch { /* ignore */ }
        }
      }, 20000);
    }
  },

  async refresh() {
    try {
      state.menu = await Store.getMenu();
      state.cart = Store.getCart();
      if (Store.user) {
        state.user = Store.user;
        state.favorites = await Store.getFavorites();
        state.orders = await Store.getOrders();
        if (state.user.role === "admin") state.users = await Store.getUsers();
      } else {
        state.user = null;
        state.favorites = [];
        state.orders = [];
        state.users = [];
      }
    } catch (e) {
      console.error(e);
      toast(e.message || "Failed to load data.", "error");
    }
  },

  async reload() {
    await app.refresh();
    render();
  },

  goto(view, authView) {
    if (authView) state.authView = authView;
    if (PROTECTED.includes(view) && !state.user) {
      state.view = "auth";
    } else {
      state.view = view;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    render();
  },

  /* -------------------- auth -------------------- */
  setAuthTab(tab) {
    state.authTab = tab;
    state.authView = "login";
    render();
  },
  setAuthView(v) {
    state.authView = v;
    render();
  },

  async doLogin(e) {
    e.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPass").value;
    if (!email || !password) { toast("Enter your email and password.", "error"); return; }
    try {
      const user = await Store.login(email, password);
      state.user = user;
      await app.refresh();
      toast(`Welcome back, ${user.name.split(" ")[0]}! 👋`);
      app.landing(user.role);
    } catch (err) {
      toast(err.message || "Sign-in failed.", "error");
    }
  },

  async doSignup(e) {
    e.preventDefault();
    const name = $("#suName").value.trim();
    const email = $("#suEmail").value.trim();
    const password = $("#suPass").value;
    const role = $("#suRole").value;
    if (!name || !email || !password) { toast("Please fill in every field.", "error"); return; }
    try {
      const user = await Store.signup({ name, email, password, role });
      state.user = user;
      await app.refresh();
      toast(`Account created — welcome, ${name.split(" ")[0]}! 🎉`);
      app.landing(user.role);
    } catch (err) {
      toast(err.message || "Sign-up failed.", "error");
    }
  },

  async demoLogin(role) {
    const d = (window.CCPOS_DEMO || {})[role];
    if (!d) { toast("Demo account unavailable.", "warn"); return; }
    try {
      const user = await Store.login(d.email, d.password);
      state.user = user;
      await app.refresh();
      toast(`Signed in as ${ROLE_META[role].label} (demo)`);
      app.landing(user.role);
    } catch (err) {
      toast(err.message || "Demo login failed.", "error");
    }
  },

  landing(role) {
    if (role === "admin") {
      state.consoleTab = "overview";
      state.view = "console";
    } else if (role === "staff") {
      state.consoleTab = "orders";
      state.view = "console";
    } else {
      state.view = "home";
    }
    render();
  },

  async logout() {
    try { await Store.logout(); } catch { /* ignore */ }
    state.user = null;
    state.orders = [];
    state.favorites = [];
    state.users = [];
    state.cart = [];
    const m = $("#userMenu"); if (m) m.classList.remove("open");
    toast("Signed out.");
    state.view = "home";
    render();
  },

  toggleUserMenu() {
    let menu = $("#userMenu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "userMenu";
      menu.className = "user-menu";
      document.body.appendChild(menu);
    }
    const u = state.user;
    if (!u) { app.goto("auth", "login"); return; }

    const isStaff = ["staff", "admin"].includes(u.role);
    menu.innerHTML = `
      <div style="padding:12px 18px;border-bottom:1px solid var(--line);margin-bottom:6px">
        <div style="font-weight:800">${esc(u.name)} ${roleBadge(u.role)}</div>
        <div style="font-size:0.8rem;color:var(--muted)">${esc(u.email)}</div>
      </div>
      ${isStaff ? `<button onclick="app.goto('console');app.closeUserMenu()">🎛️ Console</button>` : ""}
      ${!isStaff ? `<button onclick="app.goto('history');app.closeUserMenu()">📜 My Orders</button>` : ""}
      ${!isStaff ? `<button onclick="app.goto('favorites');app.closeUserMenu()">❤️ Favorites</button>` : ""}
      <button onclick="app.goto('menu');app.closeUserMenu()">🍽️ Menu</button>
      <div class="user-menu divider"></div>
      <button onclick="app.logout()">🚪 Sign out</button>`;
    menu.classList.add("open");
    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target) && e.target.id !== "userBtn") {
          menu.classList.remove("open");
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 0);
  },
  closeUserMenu() {
    const m = $("#userMenu");
    if (m) m.classList.remove("open");
  },

  /* -------------------- filters -------------------- */
  setCategory(cat, goMenu) {
    state.category = cat;
    if (goMenu || state.view !== "home") state.view = "menu";
    render();
  },
  setDietary(d) {
    state.dietary = d;
    render();
  },
  resetFilters() {
    state.category = "All";
    state.dietary = "All";
    state.search = "";
    const input = $("#navSearch"); if (input) input.value = "";
    render();
  },
  onSearch(value) {
    state.search = value;
    if (state.view !== "menu") state.view = "menu";
    render();
  },
  mobileSearch(value) {
    state.search = value;
    render();
    const el = $(".mobile-search input");
    if (el) { el.focus(); el.setSelectionRange(value.length, value.length); }
  },

  /* -------------------- cart -------------------- */
  addToCart(id, qty = 1) {
    if (!state.user) {
      toast("Please sign in to start ordering.", "warn");
      app.goto("auth", "login");
      return;
    }
    const item = itemById(id);
    if (!item) return;
    if (!item.available) { toast("This item is sold out.", "warn"); return; }
    const existing = state.cart.find((c) => c.id === id);
    if (existing) existing.qty += qty;
    else state.cart.push({ id, qty });
    persistCart();
    toast(`${item.name} added to cart`);
  },
  changeQty(id, delta) {
    const entry = state.cart.find((c) => c.id === id);
    if (!entry) return;
    entry.qty += delta;
    if (entry.qty <= 0) state.cart = state.cart.filter((c) => c.id !== id);
    persistCart();
  },
  removeFromCart(id) {
    state.cart = state.cart.filter((c) => c.id !== id);
    persistCart();
  },
  openCart() {
    if (!state.user) {
      toast("Please sign in to view your cart.", "warn");
      app.goto("auth", "login");
      return;
    }
    state.cartOpen = true;
    state.checkoutStep = "cart";
    renderCart();
    $("#cartDrawer").classList.add("open");
    $("#overlay").classList.add("open");
  },
  closeCart() {
    state.cartOpen = false;
    $("#cartDrawer").classList.remove("open");
    $("#overlay").classList.remove("open");
  },
  goCheckout() {
    if (state.cart.length === 0) { toast("Your cart is empty.", "warn"); return; }
    state.checkoutStep = "checkout";
    renderCart();
  },
  backToCart() {
    state.checkoutStep = "cart";
    renderCart();
  },
  selectSlot(s) { state.selectedSlot = s; renderCart(); },
  selectPayment(p) { state.paymentMethod = p; renderCart(); },

  async placeOrder() {
    if (!state.user) { toast("Please sign in first.", "warn"); return; }
    const nameInput = $("#coName");
    const customerName = (nameInput?.value || state.user.name).trim();
    if (!customerName) { toast("Please enter a name for the order.", "error"); return; }

    const items = state.cart
      .map((c) => {
        const m = itemById(c.id);
        return m ? { id: m.id, name: m.name, price: m.price, qty: c.qty, emoji: m.emoji, dietary: m.dietary } : null;
      })
      .filter(Boolean);

    if (items.length === 0) { toast("Your cart is empty.", "warn"); return; }

    try {
      const order = await Store.createOrder({
        customerName,
        role: state.user.role,
        items,
        total: cartTotal(),
        slot: state.selectedSlot,
        payment: state.paymentMethod
      });
      state.cart = [];
      Store.setCart([]);
      await app.refresh();
      app.closeCart();
      state.trackingId = order.id;
      state.view = "tracking";
      render();
      toast("Order placed! We'll notify you when it's ready 🎉");
    } catch (err) {
      toast(err.message || "Could not place the order.", "error");
    }
  },

  viewOrder(id) {
    state.trackingId = id;
    state.view = "tracking";
    render();
  },

  reorder(id) {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;
    order.items.forEach((i) => {
      const item = itemById(i.id);
      if (item && item.available) {
        const existing = state.cart.find((c) => c.id === item.id);
        if (existing) existing.qty += i.qty;
        else state.cart.push({ id: item.id, qty: i.qty });
      }
    });
    persistCart();
    app.openCart();
  },

  async toggleFavorite(id) {
    if (!state.user) { toast("Sign in to save favorites.", "warn"); app.goto("auth", "login"); return; }
    try {
      const added = await Store.toggleFavorite(id);
      state.favorites = await Store.getFavorites();
      toast(added ? "Added to favorites ❤️" : "Removed from favorites", added ? "success" : "warn");
      render();
    } catch (e) {
      toast(e.message || "Could not update favorites.", "error");
    }
  },

  /* -------------------- item modal -------------------- */
  openItemModal(id) {
    const item = itemById(id);
    if (!item) return;
    state.activeItem = id;
    state.itemQty = 1;
    $("#modalItemName").textContent = item.name;
    $("#modalItemBody").innerHTML = `
      <div style="font-size:5rem;text-align:center;margin-bottom:12px">${item.emoji || "🍽️"}</div>
      <p style="color:var(--muted);line-height:1.6;margin-bottom:16px">${esc(item.desc)}</p>
      <div class="card-meta" style="margin-bottom:16px">
        <span>⭐ ${Number(item.rating).toFixed(1)}</span><span>⏱ ${item.prepTime} min</span><span>${esc(item.dietary)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="app.modalQty(-1)">−</button>
          <span class="qty-val" id="modalQtyVal">1</span>
          <button class="qty-btn" onclick="app.modalQty(1)">+</button>
        </div>
        <div class="card-price">${money(item.price)}</div>
      </div>`;
    $("#modalItemFooter").innerHTML = `
      <button class="btn btn-ghost" data-close-item>Close</button>
      <button class="btn btn-primary" onclick="app.addFromModal()" ${!item.available ? "disabled" : ""}>${item.available ? "Add to cart" : "Sold out"}</button>`;
    $("#itemModal").style.display = "flex";
  },
  modalQty(delta) {
    state.itemQty = Math.max(1, state.itemQty + delta);
    $("#modalQtyVal").textContent = state.itemQty;
  },
  addFromModal() {
    app.addToCart(state.activeItem, state.itemQty);
    $("#itemModal").style.display = "none";
  },
  closeItemModal() {
    $("#itemModal").style.display = "none";
  },

  /* -------------------- console tabs -------------------- */
  consoleTab(tab) {
    state.consoleTab = tab;
    render();
  },

  filterStaff(q) {
    state.staffSearch = q;
    render();
    const input = $("#staffSearchInput");
    if (input) { input.focus(); input.setSelectionRange(q.length, q.length); }
  },
  setStaffRoleFilter(v) {
    state.staffRoleFilter = v;
    render();
  },

  /* -------------------- staff management -------------------- */
  openAddStaff() {
    openModal("Add staff / admin", `
      <form class="modal-form" onsubmit="app.createStaff(event)">
        <div class="field"><label>Full name</label><input id="nsName" required placeholder="e.g. Priya Nair"/></div>
        <div class="field"><label>Work email</label><input id="nsEmail" type="email" required placeholder="name@campus.edu"/></div>
        <div class="field"><label>Temporary password</label><input id="nsPass" type="password" minlength="6" required placeholder="At least 6 characters"/></div>
        <div class="field"><label>Role</label>
          <select id="nsRole"><option value="staff">👨‍🍳 Staff (menu + orders)</option><option value="admin">🛡️ Admin (full access)</option></select>
        </div>
        <button class="btn btn-primary btn-full" type="submit">Create account</button>
      </form>`, "");
  },

  async createStaff(e) {
    e.preventDefault();
    const data = {
      name: $("#nsName").value.trim(),
      email: $("#nsEmail").value.trim(),
      password: $("#nsPass").value,
      role: $("#nsRole").value
    };
    if (!data.name || !data.email || !data.password) { toast("Please fill every field.", "error"); return; }
    try {
      await Store.adminCreateUser(data);
      await app.refresh();
      closeModal();
      toast(`${ROLE_META[data.role].label} account created ✓`);
      render();
    } catch (err) {
      toast(err.message || "Could not create the account.", "error");
    }
  },

  async toggleUserActive(id) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return;
    if (id === state.user.id) { toast("You can't disable your own account.", "warn"); return; }
    try {
      await Store.updateUser(id, { active: !u.active });
      await app.refresh();
      toast(`${u.name} is now ${!u.active ? "active" : "disabled"}`);
      render();
    } catch (e) { toast(e.message || "Update failed.", "error"); }
  },

  async changeUserRole(id, role) {
    if (id === state.user.id) { toast("You can't change your own role here.", "warn"); return; }
    try {
      await Store.updateUser(id, { role });
      await app.refresh();
      toast(`Role updated to ${ROLE_META[role].label}`);
      render();
    } catch (e) { toast(e.message || "Update failed.", "error"); }
  },

  async deleteUser(id) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return;
    if (id === state.user.id) { toast("You can't delete yourself.", "warn"); return; }
    if (!confirm(`Delete the account for "${u.name}"? This cannot be undone.`)) return;
    try {
      await Store.deleteUser(id);
      await app.refresh();
      toast("Account deleted.", "warn");
      render();
    } catch (e) { toast(e.message || "Delete failed.", "error"); }
  },

  /* -------------------- menu management -------------------- */
  async saveMenuItem(e) {
    e.preventDefault();
    const editId = $("#miEditId").value;
    const data = {
      name: $("#miName").value.trim(),
      price: Number($("#miPrice").value),
      category: $("#miCategory").value,
      dietary: $("#miDietary").value,
      emoji: $("#miEmoji").value.trim() || "🍲",
      prepTime: Number($("#miPrep").value) || 10,
      desc: $("#miDesc").value.trim() || "Freshly prepared campus favourite.",
      image: $("#miImage").value.trim(),
      available: $("#miAvailable").value === "true",
      rating: 4.5,
      badge: ""
    };
    if (!data.name || !data.price) { toast("Name and price are required.", "error"); return; }
    try {
      if (editId) await Store.updateMenuItem(editId, data);
      else await Store.addMenuItem(data);
      await app.refresh();
      app.resetMenuForm();
      toast(editId ? "Item updated ✓" : "Item added to menu ✓");
      render();
    } catch (err) {
      toast(err.message || "Could not save the item.", "error");
    }
  },

  editMenuItem(id) {
    const m = itemById(id);
    if (!m) return;
    $("#miEditId").value = id;
    $("#miName").value = m.name;
    $("#miPrice").value = m.price;
    $("#miCategory").value = m.category;
    $("#miDietary").value = m.dietary;
    $("#miEmoji").value = m.emoji || "🍲";
    $("#miPrep").value = m.prepTime;
    $("#miDesc").value = m.desc;
    $("#miImage").value = m.image || "";
    $("#miAvailable").value = String(m.available);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Editing — update the fields, then Save item.");
  },

  resetMenuForm() {
    ["miName", "miPrice", "miDesc", "miImage"].forEach((id) => {
      const el = $("#" + id); if (el) el.value = "";
    });
    const edit = $("#miEditId"); if (edit) edit.value = "";
  },

  async toggleAvailability(id) {
    const m = itemById(id);
    if (!m) return;
    try {
      await Store.updateMenuItem(id, { ...m, available: !m.available });
      await app.refresh();
      toast(`${m.name} is now ${!m.available ? "available" : "sold out"}`, !m.available ? "success" : "warn");
      render();
    } catch (e) { toast(e.message || "Update failed.", "error"); }
  },

  async deleteMenuItem(id) {
    const m = itemById(id);
    if (!m) return;
    if (!confirm(`Delete "${m.name}" from the menu?`)) return;
    try {
      await Store.deleteMenuItem(id);
      await app.refresh();
      toast("Item deleted.", "warn");
      render();
    } catch (e) { toast(e.message || "Delete failed.", "error"); }
  },

  /* -------------------- orders (staff/admin) -------------------- */
  async advanceOrder(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    const next = { placed: "preparing", preparing: "ready", ready: "completed" }[o.status];
    if (!next) return;
    try {
      await Store.updateOrderStatus(id, next);
      await app.refresh();
      toast(`Order #${id.slice(-6).toUpperCase()} → ${statusLabel(next)}`);
      render();
    } catch (e) { toast(e.message || "Update failed.", "error"); }
  },

  async cancelOrder(id) {
    try {
      await Store.updateOrderStatus(id, "cancelled");
      await app.refresh();
      toast("Order cancelled.", "warn");
      render();
    } catch (e) { toast(e.message || "Cancel failed.", "error"); }
  },

  /* -------------------- theme -------------------- */
  toggleTheme() {
    const key = window.CCPOS_THEME_KEY || "ccpos_theme";
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem(key, next);
    applyTheme();
    toast(next === "dark" ? "Dark mode on 🌙" : "Light mode on ☀️");
  }
};

/* ------------------------------------------------------------------ */
/*  GLOBAL EVENT BINDING                                               */
/* ------------------------------------------------------------------ */
let bound = false;
function bindGlobalEvents() {
  if (bound) return;
  bound = true;

  // Static navbar / drawers
  $("#themeToggle").addEventListener("click", () => app.toggleTheme());
  $("#cartBtn").addEventListener("click", () => app.openCart());
  $("#closeCart").addEventListener("click", () => app.closeCart());
  $("#overlay").addEventListener("click", () => app.closeCart());
  $("#brandBtn").addEventListener("click", () => app.goto("home"));

  const search = $("#navSearch");
  if (search) {
    search.addEventListener("input", (e) => app.onSearch(e.target.value));
  }

  // Modal close buttons
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-item]")) app.closeItemModal();
    if (e.target.closest("[data-close-generic]")) closeModal();
  });

  // Delegated menu-card clicks
  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) { app.addToCart(addBtn.dataset.add); return; }

    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) { app.toggleFavorite(favBtn.dataset.fav); return; }

    const card = e.target.closest(".card");
    if (card && !e.target.closest("button")) {
      const add = card.querySelector("[data-add]");
      if (add) app.openItemModal(add.dataset.add);
    }
  });

  // Live refresh for staff/admin consoles
  setInterval(async () => {
    if (!state.user || !["staff", "admin"].includes(state.user.role)) return;
    if (state.view !== "console") return;
    const modal = $("#genericModal");
    if (modal && modal.style.display === "flex") return;
    const ae = document.activeElement;
    if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
    await app.refresh();
    render();
  }, 15000);
}

/* ------------------------------------------------------------------ */
/*  BOOT                                                               */
/* ------------------------------------------------------------------ */
window.app = app;
window.router = router;
app.init();
