'use strict';
/* HardWare Plus POS — Single-Page Application (vanilla JS, no build step) */

// ═══════════════════════ STATE ════════════════════════════════════
const S = {
  token:    localStorage.getItem('pos_token'),
  user:     null,
  settings: {},
  view:     'dashboard',
  // POS
  cart:     [],
  products: [],
  categories: [],
  customers: [],
  posFilter: '',
  posCatFilter: '',
  selectedCustomer: null,
  discount: 0,
  // Misc
  charts: {},
};

// ═══════════════════════ API CLIENT ════════════════════════════════
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (S.token) opts.headers['Authorization'] = `Bearer ${S.token}`;
  if (body)    opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  if (r.status === 401) { logout(); return null; }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}
const GET  = (p)    => api('GET',    p);
const POST = (p, b) => api('POST',   p, b);
const PUT  = (p, b) => api('PUT',    p, b);
const DEL  = (p)    => api('DELETE', p);

// ═══════════════════════ FORMATTERS ════════════════════════════════
function fmt(n) {
  const sym = S.settings.currency_symbol || 'K';
  return `${sym} ${(+n || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtN(n) { return (+n || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZM', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ZM', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-ZM', { hour:'2-digit', minute:'2-digit' });
}
function pct(a, b) { return b ? ((a/b)*100).toFixed(1)+'%' : '0%'; }
function esc(s) {
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}

// ═══════════════════════ NOTIFICATIONS ══════════════════════════════
function notify(msg, type = 'info') {
  const c = document.getElementById('notify-container');
  const el = document.createElement('div');
  el.className = `notify ${type}`;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ═══════════════════════ MODAL ════════════════════════════════════
function showModal(html, cls = '') {
  const ov = document.getElementById('modal-overlay');
  ov.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  ov.classList.remove('hidden');
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); }, { once: true });
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function confirm2(msg) {
  return new Promise(resolve => {
    showModal(`
      <div class="modal-header"><h3>Confirm</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body"><p>${esc(msg)}</p></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">Confirm</button>
      </div>`, 'modal-sm');
    document.getElementById('confirm-yes').onclick = () => { closeModal(); resolve(true); };
  });
}

// ═══════════════════════ AUTH ═════════════════════════════════════
async function login(username, password) {
  const data = await POST('/auth/login', { username, password });
  if (!data) return;
  S.token    = data.token;
  S.user     = data.user;
  S.settings = data.settings || {};
  localStorage.setItem('pos_token', S.token);
  navigate('dashboard');
}

function logout() {
  if (S.token) POST('/auth/logout', {}).catch(() => {});
  S.token = null; S.user = null;
  localStorage.removeItem('pos_token');
  renderRoot();
}

async function checkAuth() {
  if (!S.token) return false;
  try {
    const data = await GET('/auth/me');
    if (!data) return false;
    S.user     = data.user;
    S.settings = data.settings || {};
    return true;
  } catch { S.token = null; localStorage.removeItem('pos_token'); return false; }
}

// ═══════════════════════ ROUTER ══════════════════════════════════
function navigate(view) {
  S.view = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderView();
}

// ═══════════════════════ SIDEBAR ══════════════════════════════════
function sidebarHTML() {
  const name = S.settings.business_name || 'HardWare Plus';
  const role = S.user?.role || '';
  const isAdmin   = ['admin'].includes(role);
  const isManager = ['admin','manager'].includes(role);

  const navItems = [
    { view:'dashboard',  icon:'📊', label:'Dashboard' },
    { view:'pos',        icon:'🛒', label:'POS Terminal' },
    null,
    { view:'products',   icon:'📦', label:'Products' },
    { view:'inventory',  icon:'🏪', label:'Inventory' },
    { view:'customers',  icon:'👥', label:'Customers' },
    { view:'sales',      icon:'🧾', label:'Sales History' },
    isManager ? { view:'purchase-orders', icon:'📋', label:'Purchase Orders' } : null,
    null,
    { view:'reports',    icon:'📈', label:'Reports & Analytics' },
    isAdmin ? { view:'users', icon:'👤', label:'Users' } : null,
    isAdmin ? { view:'settings', icon:'⚙️', label:'Settings' } : null,
  ].filter(Boolean);

  return `
    <div class="sidebar">
      <div class="sidebar-brand">
        <span class="logo-icon">🔧</span>
        <h1>${esc(name)}</h1>
        <p>Point of Sale System</p>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(item => item === null
          ? `<div style="height:8px"></div>`
          : `<div class="nav-item ${S.view===item.view?'active':''}" data-view="${item.view}" onclick="navigate('${item.view}')">
               <span class="nav-icon">${item.icon}</span>
               <span>${item.label}</span>
             </div>`
        ).join('')}
      </nav>
      <div class="sidebar-user">
        <div class="user-name">${esc(S.user?.full_name || '')}</div>
        <div class="user-role">${esc(role)}</div>
        <button class="btn-logout" onclick="logout()">Sign Out</button>
      </div>
    </div>`;
}

// ═══════════════════════ TOP BAR ══════════════════════════════════
const viewTitles = {
  dashboard: ['Dashboard','Welcome back!'],
  pos:       ['POS Terminal','Process sales quickly'],
  products:  ['Products','Manage your product catalogue'],
  inventory: ['Inventory','Track stock levels'],
  customers: ['Customers','Customer database'],
  sales:     ['Sales History','All transactions'],
  'purchase-orders': ['Purchase Orders','Restock management'],
  reports:   ['Reports & Analytics','Business intelligence'],
  users:     ['User Management','Staff accounts'],
  settings:  ['Settings','System configuration'],
};

function topbarHTML() {
  const [title, sub] = viewTitles[S.view] || ['', ''];
  return `
    <div class="topbar">
      <div>
        <div class="topbar-title">${title}</div>
        <div class="topbar-sub">${sub}</div>
      </div>
      <div class="topbar-spacer"></div>
      <div style="font-size:13px;color:var(--text-xs)">${fmtDate(new Date())}</div>
    </div>`;
}

// ═══════════════════════ ROOT RENDER ══════════════════════════════
function renderRoot() {
  const root = document.getElementById('root');
  if (!S.token || !S.user) { root.innerHTML = loginHTML(); bindLogin(); return; }

  if (S.view === 'pos') {
    root.innerHTML = `
      <div class="layout">
        ${sidebarHTML()}
        <div class="main">
          ${topbarHTML()}
          <div id="view-content"></div>
        </div>
      </div>`;
    renderView();
    return;
  }

  root.innerHTML = `
    <div class="layout">
      ${sidebarHTML()}
      <div class="main">
        ${topbarHTML()}
        <div class="content" id="view-content"></div>
      </div>
    </div>`;
  renderView();
}

async function renderView() {
  const el = document.getElementById('view-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-xs)">Loading…</div>';
  try {
    switch (S.view) {
      case 'dashboard':       await renderDashboard(); break;
      case 'pos':             await renderPOS();       break;
      case 'products':        await renderProducts();  break;
      case 'inventory':       await renderInventory(); break;
      case 'customers':       await renderCustomers(); break;
      case 'sales':           await renderSales();     break;
      case 'purchase-orders': await renderPOs();       break;
      case 'reports':         await renderReports();   break;
      case 'users':           await renderUsers();     break;
      case 'settings':        await renderSettings();  break;
      default: el.innerHTML = '<p style="padding:40px">View not found.</p>';
    }
  } catch (e) {
    el.innerHTML = `<div style="padding:40px;color:var(--danger)">${esc(e.message)}</div>`;
  }
}

// ═══════════════════════ LOGIN ═════════════════════════════════════
function loginHTML() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <span class="login-logo">🔧</span>
        <h1 class="login-title">HardWare Plus</h1>
        <p class="login-sub">Point of Sale System</p>
        <form class="login-form" id="login-form">
          <input class="login-input" id="l-user" placeholder="Username" autocomplete="username" required />
          <input class="login-input" id="l-pass" type="password" placeholder="Password" autocomplete="current-password" required />
          <button type="submit" class="login-btn" id="l-btn">Sign In</button>
          <p id="login-error" class="login-error"></p>
          <p class="login-hint">Demo: <code>admin</code> / <code>Admin123!</code> &nbsp;|&nbsp; <code>cashier1</code> / <code>Cashier123!</code></p>
        </form>
      </div>
    </div>`;
}

function bindLogin() {
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('l-btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    try {
      await login(document.getElementById('l-user').value, document.getElementById('l-pass').value);
    } catch (err) {
      errEl.textContent = err.message;
    }
    btn.disabled = false; btn.textContent = 'Sign In';
  });
}

// ═══════════════════════ DASHBOARD ════════════════════════════════
async function renderDashboard() {
  const el = document.getElementById('view-content');
  const data = await GET('/reports/dashboard');
  const k = data.kpis;
  const profitPct = k.today.revenue ? (k.today.profit / k.today.revenue * 100).toFixed(1) : 0;
  const revTrend  = k.today.revenue > k.yesterday.revenue ? 'up' : 'down';
  const txTrend   = k.today.transactions >= k.yesterday.transactions ? 'up' : 'down';

  el.innerHTML = `
    <!-- KPI CARDS -->
    <div class="kpi-grid">
      <div class="kpi-card green">
        <span class="kpi-icon">💰</span>
        <div class="kpi-label">Today's Revenue</div>
        <div class="kpi-value">${fmt(k.today.revenue)}</div>
        <div class="kpi-trend ${revTrend}">
          ${revTrend==='up'?'▲':'▼'} vs yesterday ${fmt(k.yesterday.revenue)}
        </div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon">🧾</span>
        <div class="kpi-label">Today's Transactions</div>
        <div class="kpi-value">${k.today.transactions}</div>
        <div class="kpi-trend ${txTrend}">
          ${txTrend==='up'?'▲':'▼'} vs yesterday ${k.yesterday.transactions}
        </div>
      </div>
      <div class="kpi-card purple">
        <span class="kpi-icon">📊</span>
        <div class="kpi-label">Avg Order Value</div>
        <div class="kpi-value">${fmt(k.today.avg_order)}</div>
        <div class="kpi-sub">Today's basket size</div>
      </div>
      <div class="kpi-card green">
        <span class="kpi-icon">📈</span>
        <div class="kpi-label">Gross Profit Today</div>
        <div class="kpi-value">${fmt(k.today.profit)}</div>
        <div class="kpi-sub">Margin: ${profitPct}%</div>
      </div>
      <div class="kpi-card amber">
        <span class="kpi-icon">⚠️</span>
        <div class="kpi-label">Low Stock Items</div>
        <div class="kpi-value">${k.low_stock}</div>
        <div class="kpi-sub">${k.out_of_stock} out of stock</div>
      </div>
      <div class="kpi-card cyan">
        <span class="kpi-icon">📦</span>
        <div class="kpi-label">Inventory Value</div>
        <div class="kpi-value">${fmt(k.inventory_value)}</div>
        <div class="kpi-sub">${k.total_products} active products</div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon">👥</span>
        <div class="kpi-label">Total Customers</div>
        <div class="kpi-value">${k.total_customers}</div>
        <div class="kpi-sub">Registered accounts</div>
      </div>
      <div class="kpi-card green">
        <span class="kpi-icon">📅</span>
        <div class="kpi-label">Month Revenue</div>
        <div class="kpi-value">${fmt(k.month.revenue)}</div>
        <div class="kpi-sub">${k.month.transactions} transactions</div>
      </div>
    </div>

    <!-- CHARTS ROW 1 -->
    <div class="grid-12 mb-24">
      <div class="card">
        <div class="card-header"><span class="card-title">📉 Revenue Trend — Last 30 Days</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-revenue"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🥧 Sales by Category</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-cat"></canvas></div></div>
      </div>
    </div>

    <!-- CHARTS ROW 2 -->
    <div class="grid-2 mb-24">
      <div class="card">
        <div class="card-header"><span class="card-title">🏆 Top Products — Last 30 Days</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-products"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">⏰ Hourly Sales — Today</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-hourly"></canvas></div></div>
      </div>
    </div>

    <!-- BOTTOM: Recent Sales + Low Stock -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">🧾 Recent Transactions</span>
          <div style="flex:1"></div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('sales')">View All</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Receipt</th><th>Customer</th><th>Amount</th><th>Method</th><th>Time</th>
            </tr></thead>
            <tbody>
              ${data.recentSales.map(s => `
                <tr onclick="showSaleDetail(${s.id})" style="cursor:pointer">
                  <td class="text-mono">${s.receipt_no}</td>
                  <td>${s.customer_name ? esc(s.customer_name) : '<span class="text-xs">Walk-in</span>'}</td>
                  <td><strong>${fmt(s.total_amount)}</strong></td>
                  <td>${payBadge(s.payment_method)}</td>
                  <td class="text-xs">${fmtDateTime(s.sale_date)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">⚠️ Low Stock Alerts</span>
          <div style="flex:1"></div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('inventory')">View All</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Min</th></tr></thead>
            <tbody>
              ${data.lowStockItems.length
                ? data.lowStockItems.map(p => `
                  <tr>
                    <td><strong>${esc(p.name)}</strong><br><span class="text-xs text-mono">${p.sku}</span></td>
                    <td>${esc(p.category||'')}</td>
                    <td class="${p.quantity===0?'stock-zero':'stock-low'}">${p.quantity === 0 ? 'OUT' : p.quantity}</td>
                    <td class="text-xs">${p.reorder_level}</td>
                  </tr>`).join('')
                : '<tr><td colspan="4" class="text-center text-xs" style="padding:20px">All stock levels OK ✅</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Draw charts
  buildRevenueChart(data.trend);
  buildCategoryChart(data.catSales);
  buildTopProductsChart(data.topProducts);
  buildHourlyChart(data.hourly);
}

function buildRevenueChart(trend) {
  const labels   = trend.map(r => r.date);
  const revenues = trend.map(r => r.revenue);
  destroyChart('chart-revenue');
  S.charts['chart-revenue'] = new Chart(document.getElementById('chart-revenue'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: revenues,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,.12)',
        fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { callback: v => `K${(v/1000).toFixed(0)}k`, font: { size: 11 } } },
      }
    }
  });
}

function buildCategoryChart(cats) {
  const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F43F5E','#A78BFA','#FB923C'];
  destroyChart('chart-cat');
  S.charts['chart-cat'] = new Chart(document.getElementById('chart-cat'), {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.category),
      datasets: [{ data: cats.map(c => c.revenue), backgroundColor: COLORS, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

function buildTopProductsChart(products) {
  destroyChart('chart-products');
  S.charts['chart-products'] = new Chart(document.getElementById('chart-products'), {
    type: 'bar',
    data: {
      labels: products.slice(0,8).map(p => p.name.length > 22 ? p.name.slice(0,20)+'…' : p.name),
      datasets: [{
        label: 'Revenue',
        data: products.slice(0,8).map(p => p.revenue),
        backgroundColor: '#3B82F6', borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { callback: v => `K${(v/1000).toFixed(0)}k`, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function buildHourlyChart(hourly) {
  const hours   = Array.from({ length: 12 }, (_, i) => String(i + 8).padStart(2,'0'));
  const counts  = hours.map(h => { const r = hourly.find(x => x.hour === h); return r ? r.count : 0; });
  destroyChart('chart-hourly');
  S.charts['chart-hourly'] = new Chart(document.getElementById('chart-hourly'), {
    type: 'bar',
    data: {
      labels: hours.map(h => `${h}:00`),
      datasets: [{ label: 'Transactions', data: counts, backgroundColor: '#10B981', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { font: { size: 11 } } }, y: { ticks: { stepSize: 1, font: { size: 11 } } } }
    }
  });
}

function destroyChart(id) {
  if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
}

// ═══════════════════════ POS TERMINAL ══════════════════════════════
async function renderPOS() {
  const el = document.getElementById('view-content');
  // Load data
  [S.products, S.categories, S.customers] = await Promise.all([
    GET('/products?active=1'),
    GET('/categories'),
    GET('/customers'),
  ]);

  el.innerHTML = `
    <div class="pos-layout">
      <!-- LEFT: Product search & grid -->
      <div class="pos-left">
        <div class="pos-search">
          <span style="padding:0 6px;font-size:18px">🔍</span>
          <input id="pos-search" placeholder="Search product by name, SKU or barcode… (press /)" autocomplete="off"
            oninput="filterPOSProducts()" />
          <span class="search-kbd">/</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm ${S.posCatFilter===''?'btn-primary':'btn-ghost'}" onclick="setPOSCat('')">All</button>
          ${S.categories.map(c => `
            <button class="btn btn-sm ${S.posCatFilter===String(c.id)?'btn-primary':'btn-ghost'}"
              onclick="setPOSCat('${c.id}')">
              <span class="cat-dot" style="background:${c.color}"></span>${esc(c.name)}
            </button>`).join('')}
        </div>
        <div id="product-grid" class="product-grid">${renderProductGrid()}</div>
      </div>

      <!-- RIGHT: Cart -->
      <div class="pos-right">
        <div class="cart-header">
          <h3>🛒 Cart <span id="cart-count" class="badge badge-blue">${S.cart.length}</span></h3>
          <button class="btn btn-ghost btn-sm" onclick="clearCart()">Clear</button>
        </div>
        <div class="cart-body" id="cart-body">${renderCartBody()}</div>
        <div class="cart-footer" id="cart-footer">${renderCartFooter()}</div>
      </div>
    </div>`;

  // Keyboard shortcut
  document.addEventListener('keydown', posKeyHandler);
}

function posKeyHandler(e) {
  if (e.key === '/' && document.activeElement.id !== 'pos-search') {
    e.preventDefault();
    document.getElementById('pos-search')?.focus();
  }
}

function renderProductGrid() {
  const q   = S.posFilter.toLowerCase();
  const cat = S.posCatFilter;
  const filtered = S.products.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode||'').includes(q)) &&
    (!cat || String(p.category_id) === cat)
  );
  if (!filtered.length) return `<div class="empty-state"><span class="empty-icon">📭</span><h3>No products found</h3></div>`;
  return filtered.map(p => {
    const stock = p.stock_qty || 0;
    const oos   = stock <= 0;
    return `
      <div class="product-card ${oos?'out-of-stock':''}" onclick="${oos?'':'addToCart('+p.id+')'}" data-id="${p.id}">
        <div class="p-cat">${esc(p.category_name||'')}</div>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-sku text-mono">${esc(p.sku)}</div>
        <div class="p-price">${fmt(p.selling_price)}</div>
        <div class="p-stock ${stock===0?'stock-zero':stock<=p.reorder_level?'stock-low':'stock-ok'}">
          ${stock === 0 ? 'Out of Stock' : `Stock: ${stock}`}
        </div>
      </div>`;
  }).join('');
}

function filterPOSProducts() {
  S.posFilter = document.getElementById('pos-search').value;
  document.getElementById('product-grid').innerHTML = renderProductGrid();
}

function setPOSCat(catId) {
  S.posCatFilter = catId;
  const el = document.getElementById('view-content');
  if (!el) return;
  // Re-render filter buttons
  const btns = el.querySelectorAll('[onclick^="setPOSCat"]');
  btns.forEach(b => {
    const id = b.getAttribute('onclick').match(/'([^']*)'/)?.[1] || '';
    b.className = `btn btn-sm ${S.posCatFilter === id ? 'btn-primary' : 'btn-ghost'}`;
  });
  document.getElementById('product-grid').innerHTML = renderProductGrid();
}

function addToCart(productId) {
  const prod = S.products.find(p => p.id === productId);
  if (!prod) return;
  const existing = S.cart.find(c => c.id === productId);
  if (existing) {
    if (existing.qty >= (prod.stock_qty || 999)) { notify('Not enough stock!', 'warning'); return; }
    existing.qty++;
  } else {
    S.cart.push({ id: prod.id, name: prod.name, price: prod.selling_price, cost: prod.cost_price, qty: 1, stock: prod.stock_qty || 0, tax_rate: prod.tax_rate || 16 });
  }
  refreshCart();
}

function updateQty(productId, delta) {
  const item = S.cart.find(c => c.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  if (item.qty > item.stock) { item.qty = item.stock; notify('Max stock reached', 'warning'); }
  refreshCart();
}

function setQty(productId, val) {
  const item = S.cart.find(c => c.id === productId);
  if (!item) return;
  item.qty = Math.max(1, Math.min(parseInt(val,10) || 1, item.stock));
  refreshCart();
}

function removeFromCart(productId) {
  S.cart = S.cart.filter(c => c.id !== productId);
  refreshCart();
}

function clearCart() {
  S.cart = []; S.selectedCustomer = null; S.discount = 0;
  refreshCart();
}

function refreshCart() {
  const cb = document.getElementById('cart-body');
  const cf = document.getElementById('cart-footer');
  const cc = document.getElementById('cart-count');
  if (cb) cb.innerHTML = renderCartBody();
  if (cf) cf.innerHTML = renderCartFooter();
  if (cc) cc.textContent = S.cart.length;
}

function renderCartBody() {
  if (!S.cart.length) return `
    <div class="cart-empty">
      <span class="cart-empty-icon">🛒</span>
      <p>Cart is empty.<br>Click a product to add.</p>
    </div>`;
  return S.cart.map(item => {
    const total = item.qty * item.price;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-price">${fmt(item.price)} each</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty(${item.id},-1)">−</button>
          <input class="qty-val" type="number" min="1" value="${item.qty}"
            onchange="setQty(${item.id},this.value)" style="border:1px solid var(--border);border-radius:4px;width:36px;text-align:center" />
          <button class="qty-btn" onclick="updateQty(${item.id},1)">+</button>
        </div>
        <div class="cart-item-total">${fmt(total)}</div>
        <button class="btn-remove" onclick="removeFromCart(${item.id})">✕</button>
      </div>`;
  }).join('');
}

function cartTotals() {
  const subtotal  = S.cart.reduce((s,i) => s + i.qty * i.price, 0);
  const discount  = parseFloat(S.discount || 0);
  const taxable   = subtotal - discount;
  const tax       = taxable * 0.16;
  const total     = taxable + tax;
  return { subtotal, discount, tax, total };
}

function renderCartFooter() {
  const { subtotal, discount, tax, total } = cartTotals();
  const custOptions = `<option value="">Walk-in Customer</option>` +
    S.customers.map(c => `<option value="${c.id}" ${S.selectedCustomer===c.id?'selected':''}>${esc(c.full_name)}</option>`).join('');

  return `
    <div class="customer-select-wrap">
      <label>Customer</label>
      <select onchange="S.selectedCustomer=this.value?parseInt(this.value):null">
        ${custOptions}
      </select>
    </div>
    <div class="discount-wrap">
      <label>Discount</label>
      <input type="number" min="0" value="${S.discount}" placeholder="0.00"
        onchange="S.discount=parseFloat(this.value)||0;refreshCart()" />
      <span class="text-xs">K</span>
    </div>
    <div class="cart-totals">
      <div class="cart-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${discount>0 ? `<div class="cart-row text-danger"><span>Discount</span><span>−${fmt(discount)}</span></div>` : ''}
      <div class="cart-row"><span>VAT (16%)</span><span>${fmt(tax)}</span></div>
      <div class="cart-row total"><span>TOTAL</span><span>${fmt(total)}</span></div>
    </div>
    <button class="btn btn-success btn-lg btn-block" onclick="openPaymentModal()"
      ${!S.cart.length ? 'disabled' : ''}>
      💳 Process Payment
    </button>`;
}

function openPaymentModal() {
  if (!S.cart.length) return;
  const { subtotal, discount, tax, total } = cartTotals();
  let selMethod = 'cash';
  let amountPaid = total;

  showModal(`
    <div class="modal-header"><h3>💳 Process Payment</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-bottom:4px">
          <span>Total Due:</span><span style="color:var(--primary)">${fmt(total)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-xs)">${S.cart.length} item(s) · ${S.selectedCustomer ? S.customers.find(c=>c.id===S.selectedCustomer)?.full_name||'Customer' : 'Walk-in'}</div>
      </div>

      <label class="form-label">Payment Method</label>
      <div class="payment-methods" id="pay-methods">
        ${[['cash','💵','Cash'],['card','💳','Card'],['mobile_money','📱','Mobile Money'],['credit','📝','Credit']].map(([val,icon,label])=>`
          <div class="pay-method-btn ${val===selMethod?'selected':''}" onclick="selectPayMethod('${val}',${total})">
            <span class="pay-icon">${icon}</span>${label}
          </div>`).join('')}
      </div>

      <div class="form-group" id="amount-group">
        <label class="form-label">Amount Tendered</label>
        <input class="form-input" id="amount-paid" type="number" step="0.01" value="${fmtN(total)}"
          oninput="updateChange(${total})" placeholder="${fmtN(total)}" />
      </div>

      <div class="change-display" id="change-display">
        <div class="change-label">Change Due</div>
        <div class="change-value" id="change-val">${fmt(0)}</div>
      </div>

      <div class="form-group mt-12">
        <label class="form-label">Notes (optional)</label>
        <input class="form-input" id="sale-notes" placeholder="Reference number, notes…" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success btn-lg" id="confirm-pay" onclick="confirmPayment(${total})">Confirm Sale</button>
    </div>`, 'modal');

  window._payMethod = 'cash';
  updateChange(total);
}

function selectPayMethod(method, total) {
  window._payMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  const amtGroup = document.getElementById('amount-group');
  const amtInput = document.getElementById('amount-paid');
  if (method === 'cash') {
    amtGroup.style.display = '';
    amtInput.value = fmtN(total);
    updateChange(total);
  } else {
    amtGroup.style.display = 'none';
    document.getElementById('change-val').textContent = fmt(0);
  }
}

function updateChange(total) {
  const paid   = parseFloat(document.getElementById('amount-paid')?.value) || 0;
  const change = Math.max(0, paid - total);
  const el = document.getElementById('change-val');
  if (el) el.textContent = fmt(change);
}

async function confirmPayment(total) {
  const btn = document.getElementById('confirm-pay');
  btn.disabled = true; btn.textContent = 'Processing…';
  const method = window._payMethod || 'cash';
  const amtInput = document.getElementById('amount-paid');
  const amtPaid  = method === 'cash' ? parseFloat(amtInput?.value || total) : total;
  const notes    = document.getElementById('sale-notes')?.value || '';

  try {
    const payload = {
      customer_id:     S.selectedCustomer || null,
      items:           S.cart.map(i => ({ product_id: i.id, quantity: i.qty, unit_price: i.price, discount_percent: 0 })),
      payment_method:  method,
      amount_paid:     amtPaid,
      discount_amount: S.discount || 0,
      notes,
    };
    const sale = await POST('/sales', payload);
    closeModal();
    clearCart();
    showReceiptModal(sale);
    notify('Sale completed! Receipt: ' + sale.receipt_no, 'success');
    // Refresh product stock
    const fresh = await GET('/products?active=1');
    S.products = fresh;
    document.getElementById('product-grid').innerHTML = renderProductGrid();
  } catch (e) {
    notify(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Confirm Sale';
  }
}

function showReceiptModal(sale) {
  const settings  = sale.settings || S.settings;
  const bname     = settings.business_name   || 'HardWare Plus';
  const baddr     = settings.business_address|| '';
  const bphone    = settings.business_phone  || '';
  const footer    = settings.receipt_footer  || 'Thank you!';
  const vatNo     = settings.business_vat_no || '';

  const itemsHTML = sale.items.map(it => `
    <div class="item-row">
      <div>${esc(it.product_name)}</div>
      <div class="receipt-row">
        <span>${it.quantity} × ${fmt(it.unit_price)}</span>
        <span>${fmt(it.line_total)}</span>
      </div>
    </div>`).join('');

  showModal(`
    <div class="modal-header">
      <h3>🧾 Receipt — ${esc(sale.receipt_no)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="receipt" id="receipt-area">
        <div class="receipt-header">
          <h2>${esc(bname)}</h2>
          <p>${esc(baddr)}</p>
          <p>${esc(bphone)}</p>
          ${vatNo ? `<p>VAT: ${esc(vatNo)}</p>` : ''}
        </div>
        <hr/>
        <div class="receipt-row"><span>Receipt:</span><span>${esc(sale.receipt_no)}</span></div>
        <div class="receipt-row"><span>Date:</span><span>${fmtDateTime(sale.sale_date || sale.created_at)}</span></div>
        <div class="receipt-row"><span>Cashier:</span><span>${esc(sale.cashier_name||'')}</span></div>
        ${sale.customer ? `<div class="receipt-row"><span>Customer:</span><span>${esc(sale.customer.full_name)}</span></div>` : ''}
        <hr/>
        <div class="receipt-items">${itemsHTML}</div>
        <hr/>
        <div class="receipt-row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
        ${sale.discount_amount > 0 ? `<div class="receipt-row"><span>Discount</span><span>−${fmt(sale.discount_amount)}</span></div>` : ''}
        <div class="receipt-row"><span>VAT (16%)</span><span>${fmt(sale.tax_amount)}</span></div>
        <hr/>
        <div class="receipt-row receipt-total"><span>TOTAL</span><span>${fmt(sale.total_amount)}</span></div>
        <hr/>
        <div class="receipt-row"><span>Payment</span><span>${(sale.payment_method||'').replace('_',' ').toUpperCase()}</span></div>
        <div class="receipt-row"><span>Paid</span><span>${fmt(sale.amount_paid)}</span></div>
        ${sale.change_amount > 0 ? `<div class="receipt-row"><span>Change</span><span>${fmt(sale.change_amount)}</span></div>` : ''}
        <hr/>
        <div class="receipt-footer"><p>${esc(footer)}</p></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="printReceipt()">🖨️ Print</button>
    </div>`, 'modal-sm');
}

function printReceipt() {
  const html = document.getElementById('receipt-area').innerHTML;
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(`<html><head><title>Receipt</title>
    <style>body{font-family:monospace;font-size:12px;padding:16px}
    .receipt-row{display:flex;justify-content:space-between;margin:2px 0}
    .receipt-total{font-weight:700;font-size:14px}
    hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
    h2{text-align:center;font-size:16px} p{text-align:center}
    .receipt-footer{text-align:center;margin-top:10px;font-size:11px;color:#666}
    </style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}

// ═══════════════════════ PRODUCTS ══════════════════════════════════
async function renderProducts() {
  const el = document.getElementById('view-content');
  const [products, categories, suppliers] = await Promise.all([
    GET('/products?active=1'),
    GET('/categories'),
    GET('/suppliers'),
  ]);
  const isManager = ['admin','manager'].includes(S.user?.role);

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Products</h2><p>${products.length} active products</p></div>
      ${isManager ? `<button class="btn btn-primary" onclick="openAddProduct()">+ Add Product</button>` : ''}
    </div>
    <div class="card">
      <div class="card-body" style="padding-bottom:0">
        <div class="search-bar">
          <div class="search-input-wrap">
            <span class="search-icon">🔍</span>
            <input id="prod-search" placeholder="Search by name, SKU or barcode…" oninput="filterProductTable()" />
          </div>
          <select id="prod-cat-filter" onchange="filterProductTable()" style="padding:9px;border:1.5px solid var(--border-d);border-radius:var(--radius);font-size:13px">
            <option value="">All Categories</option>
            ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table" id="prod-table">
          <thead><tr>
            <th>SKU</th><th>Product</th><th>Category</th><th>Unit</th>
            <th class="td-right">Cost</th><th class="td-right">Price</th><th class="td-right">Margin</th>
            <th class="td-right">Stock</th>${isManager ? '<th>Actions</th>' : ''}
          </tr></thead>
          <tbody id="prod-tbody">
            ${productRows(products, isManager)}
          </tbody>
        </table>
      </div>
    </div>`;

  window._allProducts = products;
  window._productCats = categories;
  window._productSups = suppliers;

  // Store for modal
  window._openAddProduct = () => showProductModal(null, categories, suppliers);
  window._openEditProduct = (id) => showProductModal(products.find(p=>p.id===id), categories, suppliers);
}

window.openAddProduct = () => window._openAddProduct?.();

function productRows(prods, isManager) {
  if (!prods.length) return `<tr><td colspan="9" class="text-center text-xs" style="padding:24px">No products found</td></tr>`;
  return prods.map(p => {
    const margin = p.cost_price ? ((p.selling_price - p.cost_price) / p.selling_price * 100).toFixed(1) + '%' : '—';
    const stockClass = p.stock_qty === 0 ? 'stock-zero' : p.stock_qty <= p.reorder_level ? 'stock-low' : 'stock-ok';
    return `
      <tr>
        <td class="text-mono">${esc(p.sku)}</td>
        <td><strong>${esc(p.name)}</strong>${p.description?`<br><span class="text-xs">${esc(p.description.slice(0,50))}</span>`:''}</td>
        <td>
          ${p.category_name ? `<span class="cat-dot" style="background:${p.color||'#3B82F6'}"></span>${esc(p.category_name)}` : '—'}
        </td>
        <td class="text-xs">${esc(p.unit)}</td>
        <td class="td-right text-xs">${fmt(p.cost_price)}</td>
        <td class="td-right"><strong>${fmt(p.selling_price)}</strong></td>
        <td class="td-right text-xs ${margin !== '—' && parseFloat(margin) > 20 ? 'text-success' : 'text-warning'}">${margin}</td>
        <td class="td-right ${stockClass}">${p.stock_qty}</td>
        ${isManager ? `
        <td><div class="td-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._openEditProduct(${p.id})">Edit</button>
        </div></td>` : ''}
      </tr>`;
  }).join('');
}

function filterProductTable() {
  const q   = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const cat = document.getElementById('prod-cat-filter')?.value || '';
  const prods = (window._allProducts||[]).filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode||'').includes(q)) &&
    (!cat || String(p.category_id) === cat)
  );
  const isManager = ['admin','manager'].includes(S.user?.role);
  document.getElementById('prod-tbody').innerHTML = productRows(prods, isManager);
}

function showProductModal(prod, categories, suppliers) {
  const isEdit = !!prod;
  showModal(`
    <div class="modal-header">
      <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">SKU *</label>
          <input class="form-input" id="p-sku" value="${esc(prod?.sku||'')}" placeholder="PT001" />
        </div>
        <div class="form-group">
          <label class="form-label">Barcode</label>
          <input class="form-input" id="p-barcode" value="${esc(prod?.barcode||'')}" placeholder="6001001000001" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input class="form-input" id="p-name" value="${esc(prod?.name||'')}" placeholder="18V Cordless Drill Kit" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" id="p-desc" value="${esc(prod?.description||'')}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="p-cat">
            <option value="">— None —</option>
            ${categories.map(c => `<option value="${c.id}" ${prod?.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Supplier</label>
          <select class="form-select" id="p-sup">
            <option value="">— None —</option>
            ${suppliers.map(s => `<option value="${s.id}" ${prod?.supplier_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Cost Price (K)</label>
          <input class="form-input" id="p-cost" type="number" step="0.01" value="${prod?.cost_price||0}" />
        </div>
        <div class="form-group">
          <label class="form-label">Selling Price (K)</label>
          <input class="form-input" id="p-sell" type="number" step="0.01" value="${prod?.selling_price||0}" />
        </div>
        <div class="form-group">
          <label class="form-label">Reorder Level</label>
          <input class="form-input" id="p-reorder" type="number" value="${prod?.reorder_level||10}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Unit</label>
          <select class="form-select" id="p-unit">
            ${['each','set','pack','box','roll','bag','tin','length','sheet','pair','kit','meter'].map(u =>
              `<option value="${u}" ${(prod?.unit||'each')===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tax Rate (%)</label>
          <input class="form-input" id="p-tax" type="number" value="${prod?.tax_rate||16}" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      ${isEdit ? `<button class="btn btn-danger" onclick="deleteProduct(${prod.id})">Deactivate</button><div style="flex:1"></div>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct(${isEdit ? prod.id : 'null'})">
        ${isEdit ? 'Save Changes' : 'Add Product'}
      </button>
    </div>`, 'modal');
}

async function saveProduct(id) {
  const body = {
    sku:           document.getElementById('p-sku').value.trim(),
    barcode:       document.getElementById('p-barcode').value.trim() || null,
    name:          document.getElementById('p-name').value.trim(),
    description:   document.getElementById('p-desc').value.trim(),
    category_id:   document.getElementById('p-cat').value || null,
    supplier_id:   document.getElementById('p-sup').value || null,
    unit:          document.getElementById('p-unit').value,
    cost_price:    parseFloat(document.getElementById('p-cost').value) || 0,
    selling_price: parseFloat(document.getElementById('p-sell').value) || 0,
    reorder_level: parseInt(document.getElementById('p-reorder').value) || 10,
    tax_rate:      parseFloat(document.getElementById('p-tax').value) || 16,
  };
  try {
    if (id) await PUT(`/products/${id}`, body);
    else    await POST('/products', body);
    closeModal();
    notify(id ? 'Product updated' : 'Product added', 'success');
    await renderProducts();
  } catch (e) { notify(e.message, 'error'); }
}

async function deleteProduct(id) {
  if (!await confirm2('Deactivate this product? It will be hidden from POS.')) return;
  await DEL(`/products/${id}`);
  closeModal();
  notify('Product deactivated', 'success');
  await renderProducts();
}

// ═══════════════════════ INVENTORY ═════════════════════════════════
async function renderInventory() {
  const el = document.getElementById('view-content');
  const inv = await GET('/inventory');
  const isManager = ['admin','manager'].includes(S.user?.role);
  const totalValue = inv.reduce((s,i) => s + i.stock_value, 0);
  const lowCount   = inv.filter(i => i.quantity <= i.reorder_level && i.quantity > 0).length;
  const outCount   = inv.filter(i => i.quantity === 0).length;

  el.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card green"><span class="kpi-icon">💰</span><div class="kpi-label">Inventory Value</div><div class="kpi-value">${fmt(totalValue)}</div></div>
      <div class="kpi-card"><span class="kpi-icon">📦</span><div class="kpi-label">Total Products</div><div class="kpi-value">${inv.length}</div></div>
      <div class="kpi-card amber"><span class="kpi-icon">⚠️</span><div class="kpi-label">Low Stock</div><div class="kpi-value">${lowCount}</div></div>
      <div class="kpi-card red"><span class="kpi-icon">❌</span><div class="kpi-label">Out of Stock</div><div class="kpi-value">${outCount}</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Stock Levels</span>
        <div style="flex:1"></div>
        <select id="inv-filter" onchange="filterInvTable()" style="padding:7px;border:1.5px solid var(--border-d);border-radius:6px;font-size:12px">
          <option value="all">All Products</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
          <option value="ok">OK</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>SKU</th><th>Product</th><th>Category</th>
            <th class="td-right">Qty</th><th class="td-right">Min</th>
            <th class="td-right">Cost</th><th class="td-right">Stock Value</th>
            ${isManager ? '<th>Adjust</th>' : ''}
          </tr></thead>
          <tbody id="inv-tbody">${invRows(inv, isManager)}</tbody>
        </table>
      </div>
    </div>`;

  window._invData = inv;
}

function invRows(rows, isManager) {
  if (!rows.length) return '<tr><td colspan="8" class="text-center text-xs" style="padding:24px">No results</td></tr>';
  return rows.map(i => `
    <tr>
      <td class="text-mono">${esc(i.sku)}</td>
      <td><strong>${esc(i.name)}</strong></td>
      <td class="text-xs">${esc(i.category||'')}</td>
      <td class="td-right ${i.quantity===0?'stock-zero font-bold':i.quantity<=i.reorder_level?'stock-low':''}">${i.quantity}</td>
      <td class="td-right text-xs">${i.reorder_level}</td>
      <td class="td-right text-xs">${fmt(i.cost_price)}</td>
      <td class="td-right text-xs">${fmt(i.stock_value)}</td>
      ${isManager ? `
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openAdjust(${i.product_id})">Adjust</button>
      </td>` : ''}
    </tr>`).join('');
}

function filterInvTable() {
  const f = document.getElementById('inv-filter').value;
  const isManager = ['admin','manager'].includes(S.user?.role);
  const filtered = (window._invData||[]).filter(i =>
    f === 'all' ? true : f === 'out' ? i.quantity === 0 : f === 'low' ? (i.quantity > 0 && i.quantity <= i.reorder_level) : i.quantity > i.reorder_level
  );
  document.getElementById('inv-tbody').innerHTML = invRows(filtered, isManager);
}

function openAdjust(productId) {
  const p = window._invData?.find(i => i.product_id === productId);
  if (!p) return;
  showModal(`
    <div class="modal-header"><h3>Adjust Stock — ${esc(p.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p style="margin-bottom:12px">Current stock: <strong>${p.quantity}</strong> ${esc(p.sku)}</p>
      <div class="form-group">
        <label class="form-label">Adjustment (+/−)</label>
        <input class="form-input" id="adj-qty" type="number" placeholder="+10 or -5" />
        <p class="form-hint">Use positive to add stock, negative to reduce.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Reason / Notes</label>
        <input class="form-input" id="adj-notes" placeholder="Stock count, damaged goods, purchase delivery…" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveAdjust(${productId})">Apply Adjustment</button>
    </div>`, 'modal-sm');
}

async function saveAdjust(productId) {
  const adj   = parseInt(document.getElementById('adj-qty').value, 10);
  const notes = document.getElementById('adj-notes').value;
  if (isNaN(adj) || adj === 0) { notify('Enter a non-zero adjustment', 'warning'); return; }
  try {
    await POST('/inventory/adjust', { product_id: productId, adjustment: adj, notes });
    closeModal();
    notify(`Stock adjusted by ${adj > 0 ? '+' : ''}${adj}`, 'success');
    await renderInventory();
  } catch (e) { notify(e.message, 'error'); }
}

// ═══════════════════════ CUSTOMERS ═════════════════════════════════
async function renderCustomers() {
  const el = document.getElementById('view-content');
  const customers = await GET('/customers');

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Customers</h2><p>${customers.length} registered customers</p></div>
      <button class="btn btn-primary" onclick="openAddCustomer()">+ Add Customer</button>
    </div>
    <div class="card">
      <div class="card-body" style="padding-bottom:0">
        <div class="search-bar">
          <div class="search-input-wrap">
            <span class="search-icon">🔍</span>
            <input id="cust-search" placeholder="Search by name or phone…" oninput="filterCustomerTable()" />
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table" id="cust-table">
          <thead><tr>
            <th>Code</th><th>Name</th><th>Phone</th><th>City</th>
            <th class="td-right">Loyalty Pts</th><th class="td-right">Credit</th>
            <th>Last Purchase</th><th>Actions</th>
          </tr></thead>
          <tbody id="cust-tbody">${custRows(customers)}</tbody>
        </table>
      </div>
    </div>`;
  window._custData = customers;
}

function custRows(custs) {
  if (!custs.length) return '<tr><td colspan="8" class="text-center text-xs" style="padding:24px">No customers found</td></tr>';
  return custs.map(c => `
    <tr onclick="openCustomerDetail(${c.id})" style="cursor:pointer">
      <td class="text-mono">${esc(c.customer_code)}</td>
      <td><strong>${esc(c.full_name)}</strong>${c.email?`<br><span class="text-xs">${esc(c.email)}</span>`:''}</td>
      <td class="text-xs">${esc(c.phone||'—')}</td>
      <td class="text-xs">${esc(c.city||'—')}</td>
      <td class="td-right"><span class="badge badge-blue">${c.loyalty_points}</span></td>
      <td class="td-right text-xs">${c.credit_limit > 0 ? fmt(c.credit_limit) : '—'}</td>
      <td class="text-xs">${fmtDate(c.last_purchase)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditCustomer(${c.id})">Edit</button></td>
    </tr>`).join('');
}

function filterCustomerTable() {
  const q = (document.getElementById('cust-search')?.value||'').toLowerCase();
  const filtered = (window._custData||[]).filter(c =>
    !q || c.full_name.toLowerCase().includes(q) || (c.phone||'').includes(q) || c.customer_code.includes(q)
  );
  document.getElementById('cust-tbody').innerHTML = custRows(filtered);
}

function openAddCustomer() { showCustomerModal(null); }
function openEditCustomer(id) { showCustomerModal(window._custData?.find(c=>c.id===id)); }

function showCustomerModal(cust) {
  showModal(`
    <div class="modal-header">
      <h3>${cust ? 'Edit Customer' : 'Add Customer'}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input class="form-input" id="c-name" value="${esc(cust?.full_name||'')}" placeholder="John Mwanza" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" id="c-phone" value="${esc(cust?.phone||'')}" placeholder="+260 9xx xxx xxx" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="c-email" type="email" value="${esc(cust?.email||'')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-input" id="c-addr" value="${esc(cust?.address||'')}" />
        </div>
        <div class="form-group">
          <label class="form-label">City</label>
          <input class="form-input" id="c-city" value="${esc(cust?.city||'')}" placeholder="Lusaka" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Credit Limit (K)</label>
        <input class="form-input" id="c-credit" type="number" value="${cust?.credit_limit||0}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="c-notes">${esc(cust?.notes||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer(${cust?.id||'null'})">
        ${cust ? 'Save' : 'Add Customer'}
      </button>
    </div>`, 'modal');
}

async function saveCustomer(id) {
  const body = {
    full_name:    document.getElementById('c-name').value.trim(),
    phone:        document.getElementById('c-phone').value.trim(),
    email:        document.getElementById('c-email').value.trim(),
    address:      document.getElementById('c-addr').value.trim(),
    city:         document.getElementById('c-city').value.trim(),
    credit_limit: parseFloat(document.getElementById('c-credit').value) || 0,
    notes:        document.getElementById('c-notes').value.trim(),
  };
  if (!body.full_name) { notify('Name is required', 'warning'); return; }
  try {
    if (id) await PUT(`/customers/${id}`, body);
    else    await POST('/customers', body);
    closeModal();
    notify(id ? 'Customer updated' : 'Customer added', 'success');
    await renderCustomers();
  } catch (e) { notify(e.message, 'error'); }
}

async function openCustomerDetail(id) {
  const data = await GET(`/customers/${id}`);
  showModal(`
    <div class="modal-header">
      <h3>👤 ${esc(data.full_name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="grid-2 mb-12">
        <div><span class="kpi-label">Lifetime Value</span><div class="kpi-value" style="font-size:18px">${fmt(data.stats?.lifetime_value||0)}</div></div>
        <div><span class="kpi-label">Total Orders</span><div class="kpi-value" style="font-size:18px">${data.stats?.total_orders||0}</div></div>
        <div><span class="kpi-label">Avg Order</span><div class="kpi-value" style="font-size:18px">${fmt(data.stats?.avg_order||0)}</div></div>
        <div><span class="kpi-label">Loyalty Points</span><div class="kpi-value" style="font-size:18px">${data.loyalty_points||0}</div></div>
      </div>
      <div class="text-xs mb-12">${esc(data.phone||'')} · ${esc(data.email||'')} · ${esc(data.city||'')}</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">Recent Purchases</div>
      <div class="table-wrap" style="max-height:220px;overflow-y:auto">
        <table class="table">
          <thead><tr><th>Receipt</th><th>Date</th><th>Items</th><th class="td-right">Total</th></tr></thead>
          <tbody>
            ${(data.sales||[]).map(s => `
              <tr>
                <td class="text-mono">${s.receipt_no}</td>
                <td class="text-xs">${fmtDate(s.sale_date)}</td>
                <td class="text-xs">${s.item_count}</td>
                <td class="td-right"><strong>${fmt(s.total_amount)}</strong></td>
              </tr>`).join('')||'<tr><td colspan="4" class="text-center text-xs">No purchases</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-outline" onclick="closeModal();openEditCustomer(${id})">Edit Customer</button>
    </div>`, 'modal');
}

// ═══════════════════════ SALES HISTORY ═════════════════════════════
async function renderSales() {
  const el = document.getElementById('view-content');
  const today = new Date().toISOString().slice(0,10);
  const from  = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const data  = await GET(`/sales?from=${from}&to=${today}&limit=200`);
  const isManager = ['admin','manager'].includes(S.user?.role);

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Sales History</h2><p>${data.total} total transactions</p></div>
    </div>
    <div class="card mb-20">
      <div class="card-body">
        <div class="report-filters">
          <input type="date" class="date-input" id="s-from" value="${from}" />
          <span class="text-xs">to</span>
          <input type="date" class="date-input" id="s-to"   value="${today}" />
          <button class="btn btn-primary btn-sm" onclick="loadSales()">Filter</button>
          <select id="s-status" onchange="loadSales()" style="padding:8px;border:1.5px solid var(--border-d);border-radius:6px;font-size:13px">
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Receipt</th><th>Date &amp; Time</th><th>Customer</th><th>Cashier</th>
            <th class="td-right">Items</th><th class="td-right">Total</th>
            <th>Method</th><th>Status</th>${isManager?'<th>Actions</th>':''}
          </tr></thead>
          <tbody id="sales-tbody">${saleRows(data.rows, isManager)}</tbody>
        </table>
      </div>
    </div>`;
}

async function loadSales() {
  const from   = document.getElementById('s-from').value;
  const to     = document.getElementById('s-to').value;
  const status = document.getElementById('s-status').value;
  const isManager = ['admin','manager'].includes(S.user?.role);
  const data = await GET(`/sales?from=${from}&to=${to}&status=${status}&limit=500`);
  document.getElementById('sales-tbody').innerHTML = saleRows(data.rows, isManager);
}

function saleRows(rows, isManager) {
  if (!rows.length) return `<tr><td colspan="9" class="text-center text-xs" style="padding:24px">No sales in this period</td></tr>`;
  return rows.map(s => `
    <tr onclick="showSaleDetail(${s.id})" style="cursor:pointer">
      <td class="text-mono">${s.receipt_no}</td>
      <td class="text-xs">${fmtDateTime(s.sale_date)}</td>
      <td>${s.customer_name ? esc(s.customer_name) : '<span class="text-xs">Walk-in</span>'}</td>
      <td class="text-xs">${esc(s.cashier_name||'')}</td>
      <td class="td-right text-xs">${s.item_count}</td>
      <td class="td-right"><strong>${fmt(s.total_amount)}</strong></td>
      <td>${payBadge(s.payment_method)}</td>
      <td>${s.status === 'voided' ? '<span class="badge badge-red">Voided</span>' : '<span class="badge badge-green">Completed</span>'}</td>
      ${isManager ? `
      <td onclick="event.stopPropagation()"><div class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="showSaleDetail(${s.id})">View</button>
        ${s.status==='completed' ? `<button class="btn btn-danger btn-sm" onclick="voidSale(${s.id})">Void</button>` : ''}
      </div></td>` : ''}
    </tr>`).join('');
}

async function showSaleDetail(id) {
  const sale = await GET(`/sales/${id}`);
  showModal(`
    <div class="modal-header">
      <h3>🧾 Sale ${esc(sale.receipt_no)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="grid-2 mb-12" style="font-size:13px">
        <div><span class="text-xs">Date</span><br><strong>${fmtDateTime(sale.sale_date)}</strong></div>
        <div><span class="text-xs">Cashier</span><br><strong>${esc(sale.cashier_name||'')}</strong></div>
        <div><span class="text-xs">Customer</span><br><strong>${sale.customer_name ? esc(sale.customer_name) : 'Walk-in'}</strong></div>
        <div><span class="text-xs">Payment</span><br>${payBadge(sale.payment_method)}</div>
      </div>
      <div class="table-wrap mb-12">
        <table class="table">
          <thead><tr><th>Product</th><th class="td-right">Qty</th><th class="td-right">Price</th><th class="td-right">Total</th></tr></thead>
          <tbody>
            ${sale.items.map(i => `
              <tr>
                <td><strong>${esc(i.product_name)}</strong><br><span class="text-mono" style="font-size:11px">${esc(i.sku)}</span></td>
                <td class="td-right">${i.quantity}</td>
                <td class="td-right">${fmt(i.unit_price)}</td>
                <td class="td-right"><strong>${fmt(i.line_total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="cart-totals">
        <div class="cart-row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
        ${sale.discount_amount > 0 ? `<div class="cart-row"><span>Discount</span><span>−${fmt(sale.discount_amount)}</span></div>` : ''}
        <div class="cart-row"><span>VAT</span><span>${fmt(sale.tax_amount)}</span></div>
        <div class="cart-row total"><span>TOTAL</span><span>${fmt(sale.total_amount)}</span></div>
        <div class="cart-row" style="margin-top:8px"><span>Amount Paid</span><span>${fmt(sale.amount_paid)}</span></div>
        ${sale.change_amount > 0 ? `<div class="cart-row"><span>Change</span><span>${fmt(sale.change_amount)}</span></div>` : ''}
      </div>
      ${sale.status === 'voided' ? '<div class="badge badge-red" style="margin-top:10px">VOIDED</div>' : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      ${['admin','manager'].includes(S.user?.role) && sale.status === 'completed'
        ? `<button class="btn btn-danger" onclick="voidSale(${sale.id})">Void Sale</button>`
        : ''}
    </div>`, 'modal');
}

async function voidSale(id) {
  if (!await confirm2('Void this sale? Stock will be returned to inventory.')) return;
  try {
    await POST(`/sales/${id}/void`, {});
    closeModal();
    notify('Sale voided', 'success');
    await renderSales();
  } catch (e) { notify(e.message, 'error'); }
}

function payBadge(method) {
  const map = { cash:'badge-green', card:'badge-blue', mobile_money:'badge-purple', credit:'badge-amber' };
  const labels = { cash:'💵 Cash', card:'💳 Card', mobile_money:'📱 Mobile', credit:'📝 Credit' };
  return `<span class="badge ${map[method]||'badge-gray'}">${labels[method]||method}</span>`;
}

// ═══════════════════════ PURCHASE ORDERS ═══════════════════════════
async function renderPOs() {
  const el = document.getElementById('view-content');
  const [orders, suppliers, products] = await Promise.all([
    GET('/purchase-orders'),
    GET('/suppliers'),
    GET('/products?active=1'),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <div><h2>Purchase Orders</h2><p>Restock management</p></div>
      <button class="btn btn-primary" onclick="openCreatePO()">+ Create PO</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>PO Number</th><th>Supplier</th><th>Date</th>
            <th class="td-right">Total</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${orders.map(po => `
              <tr>
                <td class="text-mono">${po.po_number}</td>
                <td>${esc(po.supplier_name)}</td>
                <td class="text-xs">${fmtDate(po.order_date)}</td>
                <td class="td-right">${fmt(po.total_amount)}</td>
                <td>${poBadge(po.status)}</td>
                <td><div class="td-actions">
                  ${po.status !== 'received' && po.status !== 'cancelled'
                    ? `<button class="btn btn-success btn-sm" onclick="receivePO(${po.id})">Mark Received</button>`
                    : ''}
                </div></td>
              </tr>`).join('')||'<tr><td colspan="6" class="text-center text-xs" style="padding:24px">No purchase orders</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  window._poSuppliers = suppliers;
  window._poProducts  = products;
}

function poBadge(status) {
  const map = { draft:'badge-gray', sent:'badge-blue', received:'badge-green', cancelled:'badge-red' };
  return `<span class="badge ${map[status]||'badge-gray'}">${status}</span>`;
}

function openCreatePO() {
  const suppliers = window._poSuppliers || [];
  const products  = window._poProducts  || [];
  let poItems = [{ product_id: '', qty: 1, cost: 0 }];

  const renderItems = () => poItems.map((item, idx) => `
    <div class="form-row" style="align-items:flex-end;gap:8px;margin-bottom:8px">
      <select class="form-select" onchange="poItems[${idx}].product_id=parseInt(this.value)||'';updatePOCost(${idx},this)">
        <option value="">— Product —</option>
        ${products.map(p => `<option value="${p.id}" ${item.product_id===p.id?'selected':''}>${esc(p.sku)} — ${esc(p.name)}</option>`).join('')}
      </select>
      <input class="form-input" type="number" min="1" value="${item.qty}" style="width:80px"
        onchange="poItems[${idx}].qty=parseInt(this.value)||1" placeholder="Qty" />
      <input class="form-input" type="number" step="0.01" value="${item.cost}" style="width:100px"
        onchange="poItems[${idx}].cost=parseFloat(this.value)||0" placeholder="Unit Cost" id="po-cost-${idx}" />
      <button class="btn btn-danger btn-icon" onclick="poItems.splice(${idx},1);rerenderPOItems()">&minus;</button>
    </div>`).join('') + `
    <button class="btn btn-ghost btn-sm" onclick="poItems.push({product_id:'',qty:1,cost:0});rerenderPOItems()">+ Add Item</button>`;

  showModal(`
    <div class="modal-header"><h3>Create Purchase Order</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row mb-12">
        <div class="form-group">
          <label class="form-label">Supplier *</label>
          <select class="form-select" id="po-supplier">
            <option value="">— Select Supplier —</option>
            ${suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Expected Date</label>
          <input class="form-input" id="po-date" type="date" />
        </div>
      </div>
      <label class="form-label mb-6">Items *</label>
      <div id="po-items">${renderItems()}</div>
      <div class="form-group mt-12">
        <label class="form-label">Notes</label>
        <input class="form-input" id="po-notes" placeholder="Delivery instructions…" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePO()">Create PO</button>
    </div>`, 'modal');

  window.poItems = poItems;
  window.rerenderPOItems = () => { document.getElementById('po-items').innerHTML = renderItems(); };
  window.updatePOCost = (idx, sel) => {
    const prod = products.find(p => p.id === parseInt(sel.value));
    if (prod) {
      poItems[idx].cost = prod.cost_price;
      const costEl = document.getElementById(`po-cost-${idx}`);
      if (costEl) costEl.value = prod.cost_price;
    }
  };
}

async function savePO() {
  const sup   = document.getElementById('po-supplier').value;
  const date  = document.getElementById('po-date').value;
  const notes = document.getElementById('po-notes').value;
  const items = (window.poItems||[]).filter(i => i.product_id && i.qty > 0);
  if (!sup || !items.length) { notify('Supplier and at least one item required', 'warning'); return; }
  try {
    await POST('/purchase-orders', {
      supplier_id:   parseInt(sup),
      expected_date: date,
      notes,
      items: items.map(i => ({ product_id: i.product_id, quantity_ordered: i.qty, unit_cost: i.cost })),
    });
    closeModal();
    notify('Purchase order created', 'success');
    await renderPOs();
  } catch (e) { notify(e.message, 'error'); }
}

async function receivePO(id) {
  if (!await confirm2('Mark this PO as received? Stock will be added to inventory.')) return;
  try {
    await POST(`/purchase-orders/${id}/receive`, {});
    notify('Stock received and added to inventory', 'success');
    await renderPOs();
  } catch (e) { notify(e.message, 'error'); }
}

// ═══════════════════════ REPORTS ═══════════════════════════════════
async function renderReports() {
  const el = document.getElementById('view-content');
  const today = new Date().toISOString().slice(0,10);
  const from  = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);

  el.innerHTML = `
    <div class="page-header"><div><h2>Reports & Analytics</h2><p>Business intelligence</p></div></div>

    <div class="card mb-20">
      <div class="card-body">
        <div class="report-filters">
          <strong style="font-size:13px">Date Range:</strong>
          <input type="date" class="date-input" id="r-from" value="${from}" />
          <span class="text-xs">to</span>
          <input type="date" class="date-input" id="r-to"   value="${today}" />
          <button class="btn btn-primary btn-sm" onclick="loadReport()">Run Report</button>
        </div>
      </div>
    </div>

    <div id="report-body">
      <div style="text-align:center;padding:40px;color:var(--text-xs)">Click "Run Report" to load data.</div>
    </div>`;

  await loadReport();
}

async function loadReport() {
  const from = document.getElementById('r-from').value;
  const to   = document.getElementById('r-to').value;
  const [summary, monthly] = await Promise.all([
    GET(`/reports/sales-summary?from=${from}&to=${to}`),
    GET('/reports/monthly'),
  ]);
  const s = summary.summary;

  document.getElementById('report-body').innerHTML = `
    <!-- Summary KPIs -->
    <div class="kpi-grid mb-24">
      <div class="kpi-card green"><span class="kpi-icon">💰</span><div class="kpi-label">Revenue</div><div class="kpi-value">${fmt(s?.revenue||0)}</div><div class="kpi-sub">Period total</div></div>
      <div class="kpi-card green"><span class="kpi-icon">📈</span><div class="kpi-label">Gross Profit</div><div class="kpi-value">${fmt(s?.profit||0)}</div><div class="kpi-sub">Margin: ${s?.revenue ? pct(s.profit,s.revenue) : '0%'}</div></div>
      <div class="kpi-card"><span class="kpi-icon">🧾</span><div class="kpi-label">Transactions</div><div class="kpi-value">${s?.transactions||0}</div></div>
      <div class="kpi-card purple"><span class="kpi-icon">📊</span><div class="kpi-label">Avg Order Value</div><div class="kpi-value">${fmt(s?.avg_order||0)}</div></div>
      <div class="kpi-card amber"><span class="kpi-icon">💸</span><div class="kpi-label">Total Discounts</div><div class="kpi-value">${fmt(s?.total_discount||0)}</div></div>
      <div class="kpi-card"><span class="kpi-icon">🏦</span><div class="kpi-label">VAT Collected</div><div class="kpi-value">${fmt(s?.total_tax||0)}</div></div>
    </div>

    <!-- Revenue & Profit Monthly -->
    <div class="card mb-24">
      <div class="card-header"><span class="card-title">📅 Monthly Revenue & Profit — Last 12 Months</span></div>
      <div class="card-body"><div class="chart-wrap-lg"><canvas id="r-monthly"></canvas></div></div>
    </div>

    <!-- Category + Payment Methods -->
    <div class="grid-2 mb-24">
      <div class="card">
        <div class="card-header"><span class="card-title">🏷️ Revenue by Category</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="r-cat"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">💳 Payment Methods</span></div>
        <div class="card-body"><div class="chart-wrap"><canvas id="r-pay"></canvas></div></div>
      </div>
    </div>

    <!-- Top Products Table -->
    <div class="card mb-24">
      <div class="card-header"><span class="card-title">🏆 Top Products</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Product</th><th>SKU</th><th class="td-right">Units Sold</th><th class="td-right">Revenue</th></tr></thead>
          <tbody>
            ${summary.topProds.map(p => `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td class="text-mono text-xs">${esc(p.sku)}</td>
                <td class="td-right">${p.units}</td>
                <td class="td-right"><strong>${fmt(p.revenue)}</strong></td>
              </tr>`).join('')||'<tr><td colspan="4" class="text-center text-xs">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cashier Performance -->
    <div class="card">
      <div class="card-header"><span class="card-title">👤 Cashier Performance</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Cashier</th><th class="td-right">Transactions</th><th class="td-right">Revenue</th></tr></thead>
          <tbody>
            ${summary.byCashier.map(c => `
              <tr>
                <td>${esc(c.full_name)}</td>
                <td class="td-right">${c.transactions}</td>
                <td class="td-right"><strong>${fmt(c.revenue)}</strong></td>
              </tr>`).join('')||'<tr><td colspan="3" class="text-center text-xs">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  // Monthly chart
  destroyChart('r-monthly');
  S.charts['r-monthly'] = new Chart(document.getElementById('r-monthly'), {
    type: 'bar',
    data: {
      labels: monthly.map(r => r.month),
      datasets: [
        { label: 'Revenue', data: monthly.map(r => r.revenue), backgroundColor: '#3B82F6', borderRadius: 4 },
        { label: 'Profit',  data: monthly.map(r => r.profit),  backgroundColor: '#10B981', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 12 } } } },
      scales: {
        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { callback: v => `K${(v/1000).toFixed(0)}k`, font: { size: 11 } } }
      }
    }
  });

  // Category chart
  const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F43F5E','#A78BFA','#FB923C'];
  destroyChart('r-cat');
  S.charts['r-cat'] = new Chart(document.getElementById('r-cat'), {
    type: 'doughnut',
    data: {
      labels: summary.byCategory.map(c => c.category),
      datasets: [{ data: summary.byCategory.map(c => c.revenue), backgroundColor: COLORS, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });

  // Payment methods
  destroyChart('r-pay');
  S.charts['r-pay'] = new Chart(document.getElementById('r-pay'), {
    type: 'pie',
    data: {
      labels: summary.byPayment.map(p => p.payment_method.replace('_',' ')),
      datasets: [{ data: summary.byPayment.map(p => p.total), backgroundColor: ['#10B981','#3B82F6','#8B5CF6','#F59E0B'], borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

// ═══════════════════════ USERS ═════════════════════════════════════
async function renderUsers() {
  const el = document.getElementById('view-content');
  const users = await GET('/users');

  el.innerHTML = `
    <div class="page-header">
      <div><h2>User Management</h2><p>${users.length} staff accounts</p></div>
      <button class="btn btn-primary" onclick="openAddUser()">+ Add User</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Last Login</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td class="text-mono">${esc(u.username)}</td>
                <td>${esc(u.full_name)}</td>
                <td><span class="badge ${u.role==='admin'?'badge-red':u.role==='manager'?'badge-amber':'badge-blue'}">${u.role}</span></td>
                <td class="text-xs">${esc(u.email||'—')}</td>
                <td class="text-xs">${esc(u.phone||'—')}</td>
                <td class="text-xs">${fmtDateTime(u.last_login)}</td>
                <td>${u.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="openEditUser(${u.id})">Edit</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  window._usersData = users;
}

function openAddUser()     { showUserModal(null); }
function openEditUser(id)  { showUserModal(window._usersData?.find(u=>u.id===id)); }

function showUserModal(user) {
  showModal(`
    <div class="modal-header"><h3>${user ? 'Edit User' : 'Add User'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Username *</label>
          <input class="form-input" id="u-user" value="${esc(user?.username||'')}" placeholder="cashier3" ${user?'readonly':''} />
        </div>
        <div class="form-group">
          <label class="form-label">Password ${user ? '(leave blank to keep)' : '*'}</label>
          <input class="form-input" id="u-pass" type="password" placeholder="${user ? 'New password…' : 'Password'}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input class="form-input" id="u-name" value="${esc(user?.full_name||'')}" placeholder="Jane Mwansa" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" id="u-role">
            ${['admin','manager','cashier'].map(r => `<option value="${r}" ${(user?.role||'cashier')===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Active</label>
          <select class="form-select" id="u-active">
            <option value="1" ${(user?.active??1)===1?'selected':''}>Active</option>
            <option value="0" ${user?.active===0?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="u-email" type="email" value="${esc(user?.email||'')}" /></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="u-phone" value="${esc(user?.phone||'')}" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser(${user?.id||'null'})">
        ${user ? 'Save Changes' : 'Add User'}
      </button>
    </div>`, 'modal');
}

async function saveUser(id) {
  const body = {
    full_name: document.getElementById('u-name').value.trim(),
    role:      document.getElementById('u-role').value,
    email:     document.getElementById('u-email').value.trim(),
    phone:     document.getElementById('u-phone').value.trim(),
    active:    parseInt(document.getElementById('u-active').value),
  };
  const pass = document.getElementById('u-pass').value;
  if (!id) { body.username = document.getElementById('u-user').value.trim(); body.password = pass; }
  else if (pass) { body.password = pass; }
  try {
    if (id) await PUT(`/users/${id}`, body);
    else    await POST('/users', body);
    closeModal();
    notify(id ? 'User updated' : 'User created', 'success');
    await renderUsers();
  } catch (e) { notify(e.message, 'error'); }
}

// ═══════════════════════ SETTINGS ══════════════════════════════════
async function renderSettings() {
  const el = document.getElementById('view-content');
  const settings = await GET('/settings');

  el.innerHTML = `
    <div class="page-header"><div><h2>Settings</h2><p>System configuration</p></div></div>
    <div class="card" style="max-width:700px">
      <div class="card-header"><span class="card-title">Business Information</span></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input class="form-input" id="s-bname"   value="${esc(settings.business_name||'')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-input" id="s-addr"    value="${esc(settings.business_address||'')}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="s-phone"  value="${esc(settings.business_phone||'')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="s-email" type="email" value="${esc(settings.business_email||'')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">TIN Number</label>
            <input class="form-input" id="s-tin"   value="${esc(settings.business_tin||'')}" />
          </div>
          <div class="form-group">
            <label class="form-label">VAT Registration No.</label>
            <input class="form-input" id="s-vat"   value="${esc(settings.business_vat_no||'')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Receipt Footer Message</label>
          <input class="form-input" id="s-footer"  value="${esc(settings.receipt_footer||'')}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">VAT Rate (%)</label>
            <input class="form-input" id="s-vatrate" type="number" step="0.1" value="${settings.vat_rate||16}" />
          </div>
          <div class="form-group">
            <label class="form-label">Currency Symbol</label>
            <input class="form-input" id="s-cursym" value="${esc(settings.currency_symbol||'K')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Currency Code</label>
            <input class="form-input" id="s-curcode" value="${esc(settings.currency_code||'ZMW')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Low Stock Alert Threshold</label>
            <input class="form-input" id="s-lowstock" type="number" value="${settings.low_stock_alert||10}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Receipt Number Prefix</label>
          <input class="form-input" id="s-rcpfx" value="${esc(settings.receipt_prefix||'RCP')}" />
        </div>
        <div style="margin-top:20px">
          <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
        </div>
      </div>
    </div>`;
}

async function saveSettings() {
  const body = {
    business_name:    document.getElementById('s-bname').value.trim(),
    business_address: document.getElementById('s-addr').value.trim(),
    business_phone:   document.getElementById('s-phone').value.trim(),
    business_email:   document.getElementById('s-email').value.trim(),
    business_tin:     document.getElementById('s-tin').value.trim(),
    business_vat_no:  document.getElementById('s-vat').value.trim(),
    receipt_footer:   document.getElementById('s-footer').value.trim(),
    vat_rate:         document.getElementById('s-vatrate').value,
    currency_symbol:  document.getElementById('s-cursym').value.trim(),
    currency_code:    document.getElementById('s-curcode').value.trim(),
    low_stock_alert:  document.getElementById('s-lowstock').value,
    receipt_prefix:   document.getElementById('s-rcpfx').value.trim(),
  };
  try {
    S.settings = await PUT('/settings', body);
    notify('Settings saved', 'success');
  } catch (e) { notify(e.message, 'error'); }
}

// ═══════════════════════ INIT ══════════════════════════════════════
async function init() {
  const authed = await checkAuth();
  if (authed) {
    S.view = 'dashboard';
    renderRoot();
  } else {
    renderRoot();
  }
}

document.addEventListener('DOMContentLoaded', init);
