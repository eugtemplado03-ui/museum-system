const CATEGORIES = ['Marine & Nature','Touch & Play','Toys & Collections','Character & Heritage','Environmental','Reading & Learning','Other'];
const CATEGORY_ICON = {
  'Marine & Nature':'&#128031;','Touch & Play':'&#9995;','Toys & Collections':'&#129692;',
  'Character & Heritage':'&#127942;','Environmental':'&#9851;','Reading & Learning':'&#128214;','Other':'&#10022;'
};

function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function toast(msg, isError){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
}

function openModal(html){
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e=>{ if(e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
}
function closeModal(){
  document.querySelectorAll('.modal-overlay, #modalOverlay').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
}
window.closeModal = closeModal;
if (!window._modalEscListenerAdded) {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  window._modalEscListenerAdded = true;
}

function renderImagePreviewList(paths, containerId){
  const container = document.getElementById(containerId);
  if(!container) return;
  if(!paths || paths.length === 0){
    container.innerHTML = `<div class="image-preview-empty">No photos uploaded yet.</div>`;
    return;
  }
  container.innerHTML = paths.map((src,index)=>`
    <div class="image-thumb" data-index="${index}">
      <img src="${escapeHtml(src)}" alt="Photo ${index + 1}">
      <div class="image-thumb-actions">
        <button type="button" class="btn btn-secondary btn-small replace-photo" data-index="${index}">Replace</button>
        <button type="button" class="btn btn-danger btn-small remove-photo" data-index="${index}">Remove</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.remove-photo').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.index);
      if(Number.isFinite(idx)){
        paths.splice(idx, 1);
        renderImagePreviewList(paths, containerId);
        const status = container.closest('.form-field')?.querySelector('[id$="UploadStatus"]');
        if(status) status.textContent = paths.length ? `${paths.length} photo${paths.length === 1 ? '' : 's'} ready.` : 'No photos uploaded yet.';
      }
    });
  });
  container.querySelectorAll('.replace-photo').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = Number(btn.dataset.index);
      if(!Number.isFinite(idx)) return;
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
      fileInput.addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        const status = container.closest('.form-field')?.querySelector('[id$="UploadStatus"]');
        if(status) status.textContent = 'Uploading…';
        try{
          const { path } = await Api.uploadImage(file);
          paths[idx] = path;
          renderImagePreviewList(paths, containerId);
          if(status) status.textContent = 'Photo replaced.';
        }catch(err){
          if(status) status.textContent = 'Upload failed: ' + err.message;
        }
      });
      fileInput.click();
    });
  });
}

function ensureMultipleInput(id){
  const input = document.getElementById(id);
  if(input) input.multiple = true;
}

const app = document.getElementById('app');
let exhibitsCache = [];
let categoriesCache = [];

async function loadCategories(){
  try{
    const res = await Api.listCategories();
    categoriesCache = Array.isArray(res.categories) ? res.categories : [];
  }catch(e){
    categoriesCache = [];
  }
}

function setupAdminBackButtonSecurity() {
  if (window._adminBackSecurityInit) return;
  window._adminBackSecurityInit = true;

  try {
    history.pushState({ page: 'admin_portal_secure' }, '', window.location.href);
  } catch (e) {}

  window.addEventListener('popstate', () => {
    sessionStorage.removeItem('museum_in_admin');
    if (typeof Gate !== 'undefined') {
      Gate.clearAllSessions();
    } else {
      localStorage.removeItem('museum_admin_token');
      sessionStorage.removeItem('museum_admin_token');
      localStorage.removeItem('museum_visitor_checked_in');
      sessionStorage.removeItem('museum_visitor_checked_in');
      localStorage.removeItem('museum_visitor_date');
      localStorage.removeItem('museum_visitor_name');
      sessionStorage.removeItem('museum_visitor_name');
      localStorage.removeItem('museum_visitor_session');
      sessionStorage.removeItem('museum_visitor_session');
    }
    if (typeof Api !== 'undefined') {
      Api.clearToken();
    }
    window.location.replace('/?action=signup');
  });
}

async function boot(){
  if(!Api.getToken()){
    renderLogin();
    return;
  }
  try{
    await Api.me();
    sessionStorage.setItem('museum_in_admin', 'true');
    setupAdminBackButtonSecurity();
    renderDashboard();
  }catch(e){
    Api.clearToken();
    renderLogin();
  }
}

function renderLogin(){
  closeModal();
  sessionStorage.removeItem('museum_in_admin');
  if (typeof Gate !== 'undefined') {
    Gate.clearAllSessions();
  }
  if (window.MuseoSidebar) window.MuseoSidebar.close();
  document.body.classList.remove('sidebar-open');
  window.location.replace('/?tab=admin');
}

let activeTab = 'dashboard';

const SIDEBAR_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',         icon: '📊', group: 'Overview' },
  { id: 'analytics',      label: 'Analytics',         icon: '📈', group: 'Overview' },
  { id: 'catalog',        label: 'Catalog',           icon: '🏛️', group: 'Collections' },
  { id: 'categories',     label: 'Categories',        icon: '🏷️', group: 'Collections' },
  { id: 'artifacts',      label: 'Artifacts Log',     icon: '🏺', group: 'Collections' },
  { id: 'gallery',        label: 'Gallery',           icon: '🖼️', group: 'Collections' },
  { id: 'visitors',       label: 'Visitor Log',       icon: '🟢', group: 'Operations' },
  { id: 'visitorHistory', label: 'Visitor History',   icon: '📋', group: 'Operations' },
  { id: 'programs',       label: 'Programs',          icon: '🌱', group: 'Operations' },
  { id: 'events',         label: 'Events',            icon: '📅', group: 'Operations' },
  { id: 'feedback',       label: 'Feedback',          icon: '💬', group: 'System' },
  { id: 'museumInfo',     label: 'Museum Info',       icon: 'ℹ️', group: 'System' },
];

function handleSignOut() {
  sessionStorage.removeItem('museum_in_admin');
  if (typeof Gate !== 'undefined') {
    Gate.clearAllSessions();
  } else {
    Api.clearToken();
  }
  if (window.MuseoSidebar) window.MuseoSidebar.close();
  document.body.classList.remove('sidebar-open');
  toast('Signed out successfully');
  renderLogin();
}

async function renderDashboard(){
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) toggleBtn.style.display = '';

  const activeItem = SIDEBAR_ITEMS.find(s => s.id === activeTab) || SIDEBAR_ITEMS[0];

  // Update Topbar Section Indicator
  const contextTitleEl = document.getElementById('adminContextTitle');
  if (contextTitleEl) {
    contextTitleEl.innerHTML = `<span style="margin-right:4px;">${activeItem.icon}</span> ${escapeHtml(activeItem.label)}`;
  }

  // Wire Topbar Sign Out
  const topbarSignOutBtn = document.getElementById('topbarSignOutBtn');
  if (topbarSignOutBtn && !topbarSignOutBtn._wired) {
    topbarSignOutBtn._wired = true;
    topbarSignOutBtn.addEventListener('click', handleSignOut);
  }

  // Wire Topbar Public View Button (Functional on Mobile & Desktop)
  const viewSiteBtn = document.getElementById('adminViewSiteBtn') || document.querySelector('.admin-view-site-link');
  if (viewSiteBtn && !viewSiteBtn._wired) {
    viewSiteBtn._wired = true;
    viewSiteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        sessionStorage.setItem('museum_visitor_checked_in', 'true');
        if (!sessionStorage.getItem('museum_visitor_name')) {
          sessionStorage.setItem('museum_visitor_name', 'Museum Admin');
        }
        localStorage.setItem('museum_visitor_checked_in', 'true');
      } catch (err) {}
      window.location.href = '/dashboard.html';
    });
  }

  // Grouped Sidebar Items
  const groups = [
    { name: 'Overview', items: SIDEBAR_ITEMS.filter(s => s.group === 'Overview') },
    { name: 'Collections', items: SIDEBAR_ITEMS.filter(s => s.group === 'Collections') },
    { name: 'Operations', items: SIDEBAR_ITEMS.filter(s => s.group === 'Operations') },
    { name: 'System', items: SIDEBAR_ITEMS.filter(s => s.group === 'System') }
  ];

  app.innerHTML = `
    <div class="admin-layout">
      <!-- Sidebar (Docked on Desktop, Slide Drawer on Mobile) -->
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-sidebar-brand">
          <div class="admin-sidebar-logo">M</div>
          <div class="admin-sidebar-title">Admin<br><span>Dashboard</span></div>
          <button type="button" class="admin-sidebar-close" id="adminSidebarCloseBtn" aria-label="Close admin menu">✕</button>
        </div>
        <nav class="admin-sidebar-nav">
          ${groups.map(grp => `
            <div class="admin-sidebar-section">
              <div class="admin-sidebar-section-title">${grp.name}</div>
              ${grp.items.map(item => `
                <button class="admin-sidebar-btn ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}">
                  <span class="admin-sidebar-icon">${item.icon}</span>
                  <span class="admin-sidebar-label">${item.label}</span>
                  ${item.id === 'visitors' ? '<span class="sidebar-badge live">Live</span>' : ''}
                  ${activeTab === item.id ? '<span class="admin-sidebar-indicator"></span>' : ''}
                </button>
              `).join('')}
            </div>
          `).join('')}
        </nav>
        <div class="admin-sidebar-footer">
          <button class="admin-sidebar-signout" id="signOutBtn">
            <span>⎋</span> Sign out
          </button>
        </div>
      </aside>

      <!-- Main Content Container -->
      <div class="admin-main">
        ${activeTab !== 'dashboard' ? `
          <header class="admin-topbar">
            <div class="admin-topbar-left">
              <div class="admin-topbar-icon">${activeItem.icon}</div>
              <div>
                <h1 class="admin-topbar-title">${activeItem.label}</h1>
                <p class="admin-topbar-sub">Manage ${activeItem.label.toLowerCase()} content</p>
              </div>
            </div>
          </header>
        ` : ''}

        <div id="tabContent" class="admin-content"></div>
      </div>
    </div>`;

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

  // Tab switching triggers
  app.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ 
      activeTab = btn.dataset.tab; 
      if (window.MuseoSidebar) window.MuseoSidebar.close();
      renderDashboard(); 
    });
  });

  if (window.MuseoSidebar && window.MuseoSidebar.init) {
    window.MuseoSidebar.init();
  }

  await loadCategories();
  const contentEl = document.getElementById('tabContent');
  if(activeTab === 'dashboard') await renderDashboardHomeTab(contentEl);
  else if(activeTab === 'catalog') await renderCatalogTab(contentEl);
  else if(activeTab === 'categories') await renderCategoriesTab(contentEl);
  else if(activeTab === 'visitors') await renderVisitorsTab(contentEl);
  else if(activeTab === 'visitorHistory') await renderVisitorHistoryTab(contentEl);
  else if(activeTab === 'artifacts') await renderArtifactsTab(contentEl);
  else if(activeTab === 'programs') await renderProgramsTab(contentEl);
  else if(activeTab === 'events') await renderEventsTab(contentEl);
  else if(activeTab === 'gallery') await renderGalleryTab(contentEl);
  else if(activeTab === 'analytics') await renderAnalyticsTab(contentEl);
  else if(activeTab === 'feedback') await renderFeedbackTab(contentEl);
  else if(activeTab === 'museumInfo') await renderMuseumInfoTab(contentEl);
};

let adminCatalogCategory = 'All';
let adminCatalogSearch = '';
let adminCatalogSort = 'code-asc';
let adminCategorySearch = '';

async function renderDashboardHomeTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading dashboard…</p></div>`;
  try{
    const [exhibitRes, progRes, eventRes, galleryRes, visitorRes, artifactRes, analyticsRes] = await Promise.all([
      Api.listExhibits().catch(()=>({ exhibits: [] })),
      Api.listPrograms().catch(()=>({ programs: [] })),
      Api.listEvents().catch(()=>({ events: [] })),
      Api.listGallery().catch(()=>({ gallery: [] })),
      Api.listVisitors().catch(()=>({ visitors: [] })),
      Api.listArtifactLogs().catch(()=>({ logs: [] })),
      Api.adminAnalytics().catch(()=>({ totals: { allTime: 0, last7Days: 0, last24Hours: 0 } }))
    ]);

    const exhibits = (exhibitRes && Array.isArray(exhibitRes.exhibits)) ? exhibitRes.exhibits : [];
    const programs = (progRes && Array.isArray(progRes.programs)) ? progRes.programs : [];
    const events = (eventRes && Array.isArray(eventRes.events)) ? eventRes.events : [];
    const gallery = (galleryRes && Array.isArray(galleryRes.gallery)) ? galleryRes.gallery : [];
    const visitors = (visitorRes && Array.isArray(visitorRes.visitors)) ? visitorRes.visitors : [];
    const artifacts = (artifactRes && Array.isArray(artifactRes.logs)) ? artifactRes.logs : [];
    const totals = analyticsRes?.totals || { allTime: 0, last7Days: 0, last24Hours: 0 };

    // Count by category
    const categoryCounts = {};
    exhibits.forEach(e => { const c = e.category || 'Other'; categoryCounts[c] = (categoryCounts[c] || 0) + 1; });

    // Recent visitors (last 5)
    const recentVisitors = [...visitors].sort((a,b) => new Date(b.createdAt || b.visitDate || 0) - new Date(a.createdAt || a.visitDate || 0)).slice(0, 5);

    // Upcoming events (next 3)
    const now = new Date();
    const upcomingEvents = events
      .filter(e => e.date && new Date(e.date) >= now)
      .sort((a,b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);

    // Recent gallery
    const recentGallery = [...gallery].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);

    contentEl.innerHTML = `
      <div class="dash-wrapper">
        <!-- 1. Executive Control Center Hero Banner -->
        <div class="dash-hero-banner">
          <div class="dash-hero-info">
            <div class="dash-hero-eyebrow">
              <span>🏛️</span> Museo Sang Bata sa Negros · Admin Console
            </div>
            <h1 class="dash-hero-title">Executive Control Center</h1>
            <p class="dash-hero-sub">
              Real-time operations hub for interactive room collections, floor navigation, visitor intake, and public engagement.
            </p>
          </div>
          <!-- Quick Action Commands -->
          <div class="dash-quick-actions">
            <button type="button" class="dash-action-btn primary" id="dashHeroAddExhibit">
              <span>+</span> Add Exhibit
            </button>
            <button type="button" class="dash-action-btn secondary" id="dashHeroCheckinVisitor">
              <span>🟢</span> Log Walk-in
            </button>
            <button type="button" class="dash-action-btn secondary" id="dashHeroNewEvent">
              <span>📅</span> Schedule Event
            </button>
          </div>
        </div>

        <!-- 2. KPI Stat Cards & Pie Graph Layout (3 Box, 2 Group & 1 Graph) -->
        <div class="dash-stats-graph-layout">
          <!-- Left: 2 Groups of 3 KPI Boxes -->
          <div class="dash-kpi-groups-col">
            <!-- Group 1: 3 Boxes (Collections & Operations) -->
            <div class="dash-kpi-subgroup">
              <div class="dash-group-header">
                <span class="dash-group-title"><span>🏛️</span> Collections & Operations</span>
                <span class="dash-group-badge">Group 1 · 3 Cards</span>
              </div>
              <div class="dash-kpi-grid">
                <div class="dash-kpi-card" data-tab="catalog" title="Manage Exhibits & Collections">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap teal">🏛️</div>
                    <span class="dash-kpi-badge">Collections</span>
                  </div>
                  <div class="dash-kpi-val">${exhibits.length}</div>
                  <div class="dash-kpi-lbl">Total Exhibits</div>
                  <div class="dash-kpi-sub">Interactive rooms & tags</div>
                  <div class="dash-kpi-link">Open Catalog →</div>
                </div>

                <div class="dash-kpi-card" data-tab="visitors" title="View Today's Live Visitors">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap emerald">👥</div>
                    <span class="dash-kpi-badge" style="background:rgba(16,185,129,0.2); color:#6ee7b7;">Live Feed</span>
                  </div>
                  <div class="dash-kpi-val">${visitors.length}</div>
                  <div class="dash-kpi-lbl">Visitor Records</div>
                  <div class="dash-kpi-sub">Walk-ins & tour groups</div>
                  <div class="dash-kpi-link">Open Visitor Log →</div>
                </div>

                <div class="dash-kpi-card" data-tab="programs" title="Manage Educational Programs">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap amber">🌱</div>
                    <span class="dash-kpi-badge">Learning</span>
                  </div>
                  <div class="dash-kpi-val">${programs.length}</div>
                  <div class="dash-kpi-lbl">Active Programs</div>
                  <div class="dash-kpi-sub">Workshops & cohorts</div>
                  <div class="dash-kpi-link">View Programs →</div>
                </div>
              </div>
            </div>

            <!-- Group 2: 3 Boxes (Engagements & Records) -->
            <div class="dash-kpi-subgroup">
              <div class="dash-group-header">
                <span class="dash-group-title"><span>📅</span> Engagements & Records</span>
                <span class="dash-group-badge">Group 2 · 3 Cards</span>
              </div>
              <div class="dash-kpi-grid">
                <div class="dash-kpi-card" data-tab="events" title="Manage Museum Events">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap purple">📅</div>
                    <span class="dash-kpi-badge">Calendar</span>
                  </div>
                  <div class="dash-kpi-val">${events.length}</div>
                  <div class="dash-kpi-lbl">Scheduled Events</div>
                  <div class="dash-kpi-sub">Community gatherings</div>
                  <div class="dash-kpi-link">View Calendar →</div>
                </div>

                <div class="dash-kpi-card" data-tab="gallery" title="Curate Gallery Media">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap blue">🖼️</div>
                    <span class="dash-kpi-badge">Media</span>
                  </div>
                  <div class="dash-kpi-val">${gallery.length}</div>
                  <div class="dash-kpi-lbl">Gallery Photos</div>
                  <div class="dash-kpi-sub">Visual archive & tours</div>
                  <div class="dash-kpi-link">Open Gallery →</div>
                </div>

                <div class="dash-kpi-card" data-tab="artifacts" title="Audit Artifact Logs">
                  <div class="dash-kpi-top">
                    <div class="dash-kpi-icon-wrap rose">🏺</div>
                    <span class="dash-kpi-badge">Audit</span>
                  </div>
                  <div class="dash-kpi-val">${artifacts.length}</div>
                  <div class="dash-kpi-lbl">Artifact Logs</div>
                  <div class="dash-kpi-sub">Preserved specimens</div>
                  <div class="dash-kpi-link">View Artifacts →</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: 1 Graph Design (Pie Graph Panel) -->
          <div class="dash-pie-card">
            <div class="dash-pie-header">
              <div>
                <div class="dash-pie-title">
                  <span>📊</span> Museum Distribution
                </div>
                <div class="dash-pie-sub" id="dashPieSub">Exhibits by Category & Room</div>
              </div>
              <div class="dash-pie-mode-toggles">
                <button type="button" class="dash-pie-toggle-btn active" id="pieToggleCategories" title="Show Exhibits by Category">Exhibits</button>
                <button type="button" class="dash-pie-toggle-btn" id="pieToggleResources" title="Show All Museum Metrics">Resources</button>
              </div>
            </div>
            <div class="dash-pie-chart-wrap">
              <canvas id="dashPieCanvas"></canvas>
              <div class="dash-pie-center-badge">
                <span class="dash-pie-center-num" id="dashPieCenterNum">${exhibits.length}</span>
                <span class="dash-pie-center-lbl" id="dashPieCenterLbl">Total</span>
              </div>
            </div>
            <div class="dash-pie-legend" id="dashPieLegend"></div>
          </div>
        </div>

        <!-- 3. Traffic & Engagement Banner -->
        <div class="dash-analytics-card">
          <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
            <div style="font-size:24px; background:rgba(0,240,255,0.15); width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,240,255,0.3);">📈</div>
            <div>
              <div style="font-family:'Nunito',sans-serif; font-weight:800; font-size:16px; color:#ffffff;">Public Traffic & Digital Engagement</div>
              <div style="font-size:12px; color:#94a3b8;">Analytics tracked across mobile QR scans, exhibit views, and kiosk sessions</div>
            </div>
          </div>
          <div class="dash-analytics-metrics">
            <div class="dash-metric-item">
              <div class="dash-metric-num">${totals.allTime.toLocaleString()}</div>
              <div class="dash-metric-lbl">All-Time Views</div>
            </div>
            <div class="dash-metric-item">
              <div class="dash-metric-num" style="color:#5eead4;">${totals.last7Days.toLocaleString()}</div>
              <div class="dash-metric-lbl">Last 7 Days</div>
            </div>
            <div class="dash-metric-item">
              <div class="dash-metric-num" style="color:#f59e0b;">${totals.last24Hours.toLocaleString()}</div>
              <div class="dash-metric-lbl">Last 24 Hours</div>
            </div>
            <button type="button" class="dash-panel-action" data-tab="analytics" style="padding:6px 14px; font-size:12px; border:none;">Full Analytics →</button>
          </div>
        </div>

        <!-- 4. Two-Column Operational Hub -->
        <div class="dash-two-col">
          <!-- Category Breakdown with Animated Progress Bars -->
          <div class="dash-panel-card">
            <div class="dash-panel-head">
              <div>
                <h3 class="dash-panel-title">🏷️ Exhibits by Category / Room</h3>
                <div class="dash-panel-sub">Interactive room capacity and collection distribution</div>
              </div>
              <button type="button" class="dash-panel-action" data-tab="categories" style="border:none;">Manage Rooms →</button>
            </div>
            <div class="dash-cat-list">
              ${Object.entries(categoryCounts).length ? Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
                const total = exhibits.length || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return `
                  <div class="dash-cat-row" data-tab="catalog" data-cat="${escapeHtml(cat)}" title="View ${count} exhibits in ${escapeHtml(cat)}">
                    <div class="dash-cat-header">
                      <span style="display:flex; align-items:center; gap:8px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:#00f0ff; box-shadow:0 0 6px #00f0ff; display:inline-block;"></span>
                        ${escapeHtml(cat)}
                      </span>
                      <span style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px; color:#94a3b8;">${pct}%</span>
                        <span style="background:rgba(0,240,255,0.18); border:1px solid rgba(0,240,255,0.35); color:#ffffff; font-size:11px; font-weight:800; padding:1px 8px; border-radius:999px;">${count}</span>
                      </span>
                    </div>
                    <div class="dash-cat-bar-bg">
                      <div class="dash-cat-bar-fill" style="width:${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('') : `<p style="color:#94a3b8; font-size:12px;">No categories configured yet.</p>`}
            </div>
          </div>

          <!-- Recent Live Visitors -->
          <div class="dash-panel-card">
            <div class="dash-panel-head">
              <div>
                <h3 class="dash-panel-title">👥 Recent Visitor Check-ins</h3>
                <div class="dash-panel-sub">Latest registered guests and educational groups</div>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="dash-panel-action" data-tab="visitors" style="border:none;">Live Log</button>
                <button type="button" class="dash-panel-action" data-tab="visitorHistory" style="border:none;">Archive →</button>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${recentVisitors.length ? recentVisitors.map(v => {
                const initials = (v.visitorName || 'V').split(' ').filter(Boolean).map(n=>n[0]).join('').substring(0,2).toUpperCase();
                return `
                  <div class="dash-visitor-row">
                    <div class="dash-visitor-avatar">${escapeHtml(initials)}</div>
                    <div class="dash-visitor-meta">
                      <div class="dash-visitor-name">${escapeHtml(v.visitorName)}</div>
                      <div class="dash-visitor-time">
                        ${escapeHtml(v.visitDate || 'Today')}${v.visitTime ? ` · ${escapeHtml(v.visitTime)}` : ''} · <strong>${v.pax || 1} pax</strong>${v.groupName ? ` (${escapeHtml(v.groupName)})` : ''}
                      </div>
                    </div>
                    <span class="status-badge ${(v.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'active'}" style="font-size:10px; padding:2px 8px;">
                      ${escapeHtml(v.status || 'Checked-in')}
                    </span>
                  </div>
                `;
              }).join('') : `<p style="color:#94a3b8; font-size:12px;">No recent visitors logged.</p>`}
            </div>
          </div>
        </div>

        <!-- 5. Bottom Two-Column: Upcoming Events & Gallery Showcase -->
        <div class="dash-two-col">
          <!-- Upcoming Events -->
          <div class="dash-panel-card">
            <div class="dash-panel-head">
              <div>
                <h3 class="dash-panel-title">📅 Upcoming Museum Events</h3>
                <div class="dash-panel-sub">Exhibitions, festivals, and educational workshops</div>
              </div>
              <button type="button" class="dash-panel-action" data-tab="events" style="border:none;">View All →</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${upcomingEvents.length ? upcomingEvents.map(e => {
                const d = e.date ? new Date(e.date) : null;
                const day = d && !isNaN(d.getTime()) ? d.getDate() : '—';
                const month = d && !isNaN(d.getTime()) ? d.toLocaleString('en-US', { month: 'short' }) : 'EVT';
                return `
                  <div class="dash-event-row">
                    <div class="dash-event-date-badge">
                      <span class="dash-event-day">${day}</span>
                      <span class="dash-event-month">${month}</span>
                    </div>
                    <div class="dash-event-details">
                      <div class="dash-event-title">${escapeHtml(e.title)}</div>
                      <div class="dash-event-sub">📍 ${escapeHtml(e.location || 'Museo Sang Bata sa Negros')} · ${escapeHtml(e.date || '')}</div>
                    </div>
                    <button type="button" class="dash-panel-action" data-tab="events" style="align-self:center; border:none;">View</button>
                  </div>
                `;
              }).join('') : `
                <div style="padding:14px; text-align:center; color:#94a3b8; font-size:12px; background:rgba(0,42,54,0.4); border-radius:10px;">
                  No upcoming events scheduled. Click Schedule Event to add one!
                </div>
              `}
            </div>
          </div>

          <!-- Gallery Highlights -->
          <div class="dash-panel-card">
            <div class="dash-panel-head">
              <div>
                <h3 class="dash-panel-title">🖼️ Gallery Snapshot</h3>
                <div class="dash-panel-sub">Public media highlights and tour moments</div>
              </div>
              <button type="button" class="dash-panel-action" data-tab="gallery" style="border:none;">Manage Media →</button>
            </div>
            ${recentGallery.length ? `
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                ${recentGallery.map(g => {
                  const paths = Array.isArray(g.imagePaths) && g.imagePaths.length ? g.imagePaths : (g.imagePath ? [g.imagePath] : []);
                  const img = paths[0] || '';
                  return `
                    <div class="home-gallery-mini-item" data-tab="gallery" style="border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.18); aspect-ratio:4/3; cursor:pointer;" title="${escapeHtml(g.title || 'Gallery Item')}">
                      ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(g.title || 'Gallery')}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;">` : `<div style="width:100%; height:100%; background:rgba(0,42,54,0.85); display:flex; align-items:center; justify-content:center; font-size:24px;">🖼️</div>`}
                      <div class="home-gallery-mini-overlay">
                        <div class="home-gallery-mini-caption">${escapeHtml(g.title || g.caption || 'Museum')}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `<p style="color:#94a3b8; font-size:12px;">No gallery media uploaded yet.</p>`}
          </div>
        </div>
      </div>
    `;

    // Hook quick action buttons
    document.getElementById('dashHeroAddExhibit')?.addEventListener('click', async () => {
      activeTab = 'catalog';
      await renderDashboard();
      openEditModal(null);
    });

    document.getElementById('dashHeroCheckinVisitor')?.addEventListener('click', async () => {
      activeTab = 'visitors';
      await renderDashboard();
      openVisitorWalkinModal();
    });

    document.getElementById('dashHeroNewEvent')?.addEventListener('click', async () => {
      activeTab = 'events';
      await renderDashboard();
      openEventModal(null);
    });

    // Hook category breakdown rows to filter Catalog by that category
    contentEl.querySelectorAll('.dash-cat-row[data-cat]').forEach(el => {
      el.addEventListener('click', async () => {
        adminCatalogCategory = el.dataset.cat;
        activeTab = 'catalog';
        await renderDashboard();
      });
    });

    // Wire tab navigation for any data-tab elements within contentEl
    contentEl.querySelectorAll('[data-tab]').forEach(el => {
      if (el.classList.contains('dash-cat-row')) return; // handled above
      el.addEventListener('click', async () => {
        activeTab = el.dataset.tab;
        await renderDashboard();
      });
    });

    // Initialize Dashboard Pie Chart next to the 2 groups of 3 KPI boxes
    initDashboardPieChart(exhibits, categoryCounts, { exhibits, visitors, programs, events, gallery, artifacts });

  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load dashboard</h2><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function initDashboardPieChart(exhibits, categoryCounts, resources) {
  const canvas = document.getElementById('dashPieCanvas');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet for pie chart');
    return;
  }

  const ctx = canvas.getContext('2d');
  let currentMode = 'categories'; // 'categories' or 'resources'

  const PALETTE = [
    '#00f0ff', '#10b981', '#f59e0b', '#a855f7', '#3b82f6', '#f43f5e',
    '#14b8a6', '#ec4899', '#8b5cf6', '#eab308', '#06b6d4', '#64748b'
  ];

  function buildChart(mode) {
    if (window.dashPieChartInstance) {
      window.dashPieChartInstance.destroy();
      window.dashPieChartInstance = null;
    }

    let labels = [];
    let data = [];
    let bgColors = [];
    let total = 0;

    if (mode === 'categories') {
      const entries = Object.entries(categoryCounts || {});
      if (entries.length === 0) {
        labels = ['No Exhibits'];
        data = [1];
        bgColors = ['rgba(255,255,255,0.15)'];
        total = 0;
      } else {
        entries.sort((a, b) => b[1] - a[1]);
        labels = entries.map(e => e[0]);
        data = entries.map(e => e[1]);
        bgColors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
        total = data.reduce((a, b) => a + b, 0);
      }
      const sub = document.getElementById('dashPieSub');
      if (sub) sub.textContent = 'Exhibits by Category & Room';
      const centerLbl = document.getElementById('dashPieCenterLbl');
      if (centerLbl) centerLbl.textContent = 'Exhibits';
      const centerNum = document.getElementById('dashPieCenterNum');
      if (centerNum) centerNum.textContent = total;
    } else {
      const items = [
        { label: 'Exhibits', count: (resources.exhibits || []).length, color: '#00f0ff' },
        { label: 'Visitors', count: (resources.visitors || []).length, color: '#10b981' },
        { label: 'Programs', count: (resources.programs || []).length, color: '#f59e0b' },
        { label: 'Events', count: (resources.events || []).length, color: '#a855f7' },
        { label: 'Photos', count: (resources.gallery || []).length, color: '#3b82f6' },
        { label: 'Artifacts', count: (resources.artifacts || []).length, color: '#f43f5e' }
      ];
      labels = items.map(i => i.label);
      data = items.map(i => i.count);
      bgColors = items.map(i => i.color);
      total = data.reduce((a, b) => a + b, 0);

      const sub = document.getElementById('dashPieSub');
      if (sub) sub.textContent = 'All Museum Resources Share';
      const centerLbl = document.getElementById('dashPieCenterLbl');
      if (centerLbl) centerLbl.textContent = 'Records';
      const centerNum = document.getElementById('dashPieCenterNum');
      if (centerNum) centerNum.textContent = total;
    }

    // Render Legend
    const legendEl = document.getElementById('dashPieLegend');
    if (legendEl) {
      legendEl.innerHTML = labels.map((lbl, i) => {
        const val = data[i];
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const color = bgColors[i];
        return `
          <div class="dash-pie-legend-item" data-index="${i}" title="${escapeHtml(lbl)}: ${val} (${pct}%)">
            <span class="dash-pie-legend-dot" style="background:${color}; box-shadow:0 0 6px ${color}80;"></span>
            <span style="font-weight:600;">${escapeHtml(lbl)}</span>
            <span class="dash-pie-legend-pct">${pct}%</span>
          </div>
        `;
      }).join('');

      legendEl.querySelectorAll('.dash-pie-legend-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.index, 10);
          if (window.dashPieChartInstance) {
            window.dashPieChartInstance.toggleDataVisibility(idx);
            window.dashPieChartInstance.update();
            item.style.opacity = window.dashPieChartInstance.getDataVisibility(idx) ? '1' : '0.4';
          }
        });
      });
    }

    window.dashPieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderColor: 'rgba(0, 32, 42, 0.9)',
          borderWidth: 2,
          hoverBorderColor: '#ffffff',
          hoverBorderWidth: 2.5,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 650
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(6, 28, 38, 0.92)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(0, 240, 255, 0.4)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const val = context.parsed || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  buildChart(currentMode);

  // Wire Toggle Buttons
  const toggleCats = document.getElementById('pieToggleCategories');
  const toggleRes = document.getElementById('pieToggleResources');

  toggleCats?.addEventListener('click', () => {
    if (currentMode === 'categories') return;
    currentMode = 'categories';
    toggleCats.classList.add('active');
    toggleRes?.classList.remove('active');
    buildChart('categories');
  });

  toggleRes?.addEventListener('click', () => {
    if (currentMode === 'resources') return;
    currentMode = 'resources';
    toggleRes.classList.add('active');
    toggleCats?.classList.remove('active');
    buildChart('resources');
  });
}

async function renderCatalogTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading catalog…</p></div>`;
  try{
    const [{ exhibits }, catRes] = await Promise.all([
      Api.listExhibits(),
      Api.listCategories().catch(()=>({ categories: [] }))
    ]);
    exhibitsCache = exhibits || [];
    categoriesCache = (catRes && Array.isArray(catRes.categories)) ? catRes.categories : [];
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load exhibits</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const allCats = Array.from(new Set([
    ...categoriesCache,
    ...exhibitsCache.map(e => String(e.category || 'Other').trim()).filter(Boolean)
  ]));

  let filteredExhibits = adminCatalogCategory === 'All'
    ? exhibitsCache
    : exhibitsCache.filter(e => String(e.category || 'Other').trim().toLowerCase() === adminCatalogCategory.trim().toLowerCase());

  if(adminCatalogSearch){
    const q = adminCatalogSearch.toLowerCase();
    filteredExhibits = filteredExhibits.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.code || '').toLowerCase().includes(q) ||
      (e.origin || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }

  filteredExhibits.sort((a, b) => {
    if(adminCatalogSort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
    if(adminCatalogSort === 'rating-desc') return (b.ratingAverage || 0) - (a.ratingAverage || 0);
    if(adminCatalogSort === 'favs-desc') return (b.favoriteCount || 0) - (a.favoriteCount || 0);
    return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
  });

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:260px;">
          <input type="text" id="adminCatalogSearchInput" class="admin-search-input" placeholder="Search exhibits by name, code, origin, room…" value="${escapeHtml(adminCatalogSearch)}">
          <select id="adminCatalogSortSelect" class="filter-select" style="padding:6px 28px 6px 10px; font-size:12.5px;">
            <option value="code-asc" ${adminCatalogSort==='code-asc'?'selected':''}>Sort: Code</option>
            <option value="title-asc" ${adminCatalogSort==='title-asc'?'selected':''}>Sort: Title (A–Z)</option>
            <option value="rating-desc" ${adminCatalogSort==='rating-desc'?'selected':''}>Sort: Rating</option>
            <option value="favs-desc" ${adminCatalogSort==='favs-desc'?'selected':''}>Sort: Favorites</option>
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; color:var(--ink-soft);">${filteredExhibits.length} of ${exhibitsCache.length} entries</span>
          <button class="btn btn-primary btn-small" id="addExhibitBtn">+ Add exhibit</button>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;" id="adminCatalogFilters">
        <button class="filter-chip ${adminCatalogCategory==='All'?'active':''}" data-cat="All">All (${exhibitsCache.length})</button>
        ${allCats.map(c=>{
          const count = exhibitsCache.filter(e => String(e.category||'Other').trim().toLowerCase() === c.toLowerCase()).length;
          return `<button class="filter-chip ${adminCatalogCategory.toLowerCase()===c.toLowerCase()?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} (${count})</button>`;
        }).join('')}
      </div>
    </div>
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead><tr><th>Tag</th><th>Code</th><th>Title</th><th>Category</th><th>Rating</th><th>♥</th><th>Location</th><th></th></tr></thead>
        <tbody id="ledgerBody"></tbody>
      </table>
    </div>
    ${filteredExhibits.length===0 ? `<div class="empty-state"><h2>No matching exhibits</h2><p>No exhibits found matching your search or category filter.</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminCatalogSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminCatalogSearch = e.target.value.trim();
      renderCatalogTab(contentEl);
      // keep focus
      const updatedInput = document.getElementById('adminCatalogSearchInput');
      if(updatedInput){
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });
  }

  const sortSelect = document.getElementById('adminCatalogSortSelect');
  if(sortSelect){
    sortSelect.addEventListener('change', (e)=>{
      adminCatalogSort = e.target.value;
      renderCatalogTab(contentEl);
    });
  }

  contentEl.querySelectorAll('#adminCatalogFilters [data-cat]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      adminCatalogCategory = btn.dataset.cat;
      renderCatalogTab(contentEl);
    });
  });

  const tbody = document.getElementById('ledgerBody');
  tbody.innerHTML = filteredExhibits.map(ex => `
    <tr>
      <td data-label="Tag"><div class="thumb">${ex.optimizedImagePath || ex.imagePath ? `<a href="${escapeHtml(ex.optimizedImagePath || ex.imagePath)}" target="_blank" rel="noopener">`+
          `<img class="img-enhance" src="${escapeHtml(ex.optimizedImagePath || ex.imagePath)}" onerror="this.parentElement.innerHTML='${CATEGORY_ICON[ex.category]||CATEGORY_ICON.Other}'">`+
        `</a>` : (CATEGORY_ICON[ex.category]||CATEGORY_ICON.Other)}</div></td>
      <td class="id-cell" data-label="Code">${ex.code}</td>
      <td class="title-cell" data-label="Title">
        ${escapeHtml(ex.title)}
        ${ex.videoUrl ? '<span class="video-badge" style="font-size:10.5px; margin-left:6px; background:rgba(217,79,61,0.25); color:#ff6b6b; border:1px solid rgba(217,79,61,0.4); border-radius:999px; padding:2px 7px; display:inline-flex; align-items:center; gap:3px;">▶ Video</span>' : ''}
        ${Array.isArray(ex.imagePaths) && ex.imagePaths.length > 1 ? `<span class="photo-count-badge" style="font-size:10.5px; margin-left:6px; background:rgba(0,174,189,0.25); color:#00f0ff; border:1px solid rgba(0,240,255,0.4); border-radius:999px; padding:2px 7px; display:inline-flex; align-items:center; gap:3px;">📷 ${ex.imagePaths.length} photos</span>` : ''}
      </td>
      <td data-label="Category"><span class="cat-pill">${escapeHtml(ex.category)}</span></td>
      <td data-label="Rating" style="font-size:12.5px; color:var(--ink-soft);">${ex.ratingCount ? `★ ${ex.ratingAverage} (${ex.ratingCount})` : '—'}</td>
      <td data-label="Favorites" style="font-size:12.5px; color:var(--ink-soft);">${ex.favoriteCount || 0}</td>
      <td data-label="Location" style="font-size:12.5px; color:var(--ink-soft);">
        <div style="font-weight:600; color:#e2e8f0;">${escapeHtml(ex.location||'—')}</div>
        ${ex.pinX !== null && ex.pinX !== undefined && ex.pinY !== null && ex.pinY !== undefined ? `
          <div style="font-size:11px; color:#38bdf8; font-family:'IBM Plex Mono',monospace; margin-top:2px; display:inline-flex; align-items:center; gap:4px; background:rgba(0,240,255,0.1); border:1px solid rgba(0,240,255,0.25); border-radius:4px; padding:1px 5px;">
            <span>📍 Level ${ex.floor === 2 ? 2 : 1}</span>
            <span>(${Math.round(ex.pinX)}%, ${Math.round(ex.pinY)}%)</span>
          </div>
        ` : ''}
        ${ex.directions ? `<div style="font-size:11px; color:#5eead4; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="${escapeHtml(ex.directions)}">🧭 ${escapeHtml(ex.directions)}</div>` : ''}
      </td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="btn btn-ghost dark btn-small" data-edit="${ex.id}">Edit</button>
          <button class="btn btn-ghost dark btn-small" data-tag="${ex.code}">Tag</button>
          <button class="btn btn-danger btn-small" data-delete="${ex.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('addExhibitBtn').addEventListener('click', ()=>openEditModal(null, adminCatalogCategory !== 'All' ? adminCatalogCategory : null));
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openEditModal(b.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click', ()=>confirmDelete(b.dataset.delete)));
  tbody.querySelectorAll('[data-tag]').forEach(b=>b.addEventListener('click', ()=>openTagModal(b.dataset.tag)));
}

function confirmDelete(id){
  if(!confirm('Delete this exhibit? This cannot be undone.')) return;
  Api.deleteExhibit(id)
    .then(()=>{ toast('Exhibit deleted'); renderDashboard(); })
    .catch(err=>toast(err.message, true));
}

// ─── Exhibit QR Tag Modal (Admin Only) ───
function openTagModal(code){
  const ex = exhibitsCache.find(x => x.code === code || x.id === code);
  if (!ex) { toast('Exhibit not found', true); return; }

  const qrUrl = `/api/exhibits/${encodeURIComponent(ex.code)}/qr`;

  openModal(`
    <div style="text-align: center; max-width: 480px; margin: 0 auto; position: relative;">
      <!-- Corner close button -->
      <button type="button" id="closeTagModalCornerBtn" aria-label="Close modal" style="position: absolute; top: -14px; right: -14px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; transition: all 0.15s ease;">✕</button>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-right: 24px;">
        <span class="cat-pill" style="font-size: 12px;">${escapeHtml(ex.category || 'Exhibit')}</span>
        <span class="mono" style="font-size: 13px; font-weight: 700; color: var(--teal);">${escapeHtml(ex.code)}</span>
      </div>

      <h2 style="font-size: 22px; margin: 0 0 4px; color: #fff;">${escapeHtml(ex.title)}</h2>
      <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 18px;">${escapeHtml(ex.location || 'Museum floor')}</p>

      <!-- Printable Tag Card -->
      <div id="printableQrTag" style="background: #ffffff; color: #1e293b; padding: 22px 18px; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.35); border: 2px solid #e2e8f0; margin-bottom: 18px; text-align: center;">
        <div style="font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #007d8a; margin-bottom: 4px;">Museo Sang Bata sa Negros</div>
        <div style="font-family: 'Nunito', sans-serif; font-size: 17px; font-weight: 900; color: #0f172a; margin-bottom: 12px; line-height: 1.3;">${escapeHtml(ex.title)}</div>
        
        <div style="background: #f8fafc; padding: 10px; border-radius: 12px; display: inline-block; border: 1.5px solid #e2e8f0; margin-bottom: 12px;">
          <img src="${qrUrl}" alt="QR Tag for ${escapeHtml(ex.code)}" width="210" height="210" style="display: block; border-radius: 6px;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f1f5f9; border-radius: 8px; font-size: 12px; font-weight: 700;">
          <span style="color: #64748b;">Scan with camera</span>
          <span class="mono" style="color: #0f172a; font-size: 13px;">${escapeHtml(ex.code)}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <a class="btn btn-primary" href="${qrUrl}" download="Exhibit-${escapeHtml(ex.code)}-QR-Tag.png" style="flex: 1; min-width: 170px; text-align: center; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
          ⬇ Download PNG Tag
        </a>
        <button type="button" class="btn btn-ghost dark" id="printTagBtn" style="flex: 1; min-width: 130px; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
          🖨 Print Tag
        </button>
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button type="button" class="btn btn-ghost dark" id="closeTagModalBtn">Close</button>
      </div>
    </div>
  `);

  document.getElementById('closeTagModalCornerBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  document.getElementById('closeTagModalBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  document.getElementById('printTagBtn')?.addEventListener('click', () => {
    const win = window.open('', '_blank', 'width=600,height=700');
    if (!win) { toast('Popup blocked. Please allow popups to print.', true); return; }
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print QR Tag — ${escapeHtml(ex.code)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet">
        <style>
          body { margin: 40px; font-family: 'Nunito', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
          .tag-box { border: 2.5px solid #0f172a; border-radius: 18px; padding: 30px; text-align: center; max-width: 320px; width: 100%; box-sizing: border-box; }
          .mono { font-family: 'IBM Plex Mono', monospace; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="tag-box">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #007d8a; margin-bottom: 6px;">Museo Sang Bata sa Negros</div>
          <div style="font-size: 19px; font-weight: 900; color: #0f172a; margin-bottom: 16px; line-height: 1.2;">${escapeHtml(ex.title)}</div>
          <img src="${qrUrl}" width="230" height="230" style="display: block; margin: 0 auto 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; border-top: 1.5px solid #e2e8f0; padding-top: 10px;">
            <span>Scan with camera</span>
            <span class="mono">${escapeHtml(ex.code)}</span>
          </div>
        </div>
        <script>
          window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  });
}

// ─── Interactive Floor Plan Pinpoint Picker Helpers ───
function detectRoomFromCoords(floor, pinX, pinY) {
  if (pinX == null || pinY == null) return 'No pinpoint placed';
  const x = Number(pinX);
  const y = Number(pinY);
  if (floor === 2) {
    if (x >= 13 && x <= 49 && y >= 13 && y <= 48) return 'Toys & Collections Room (Hampanganan)';
    if (x >= 50 && x <= 87 && y >= 13 && y <= 48) return 'Carnival & Discovery Room';
    if (x >= 24 && x <= 38 && y >= 48 && y <= 60) return 'Stairs Landing (To Ground Floor)';
    if (x >= 14 && x <= 86 && y >= 48 && y <= 87) return 'Mezzanine Balcony Void';
    return 'Second Floor (Mezzanine Level)';
  } else {
    if (x >= 24 && x <= 76 && y >= 10 && y <= 20) return 'Aquarium & Reef Systems';
    if (x >= 24 && x <= 76 && y >= 20 && y <= 48) return 'Marine & Nature Room (The Marine Story)';
    if (x >= 76 && x <= 90 && y >= 33 && y <= 64) return 'Touch & Play Room (Splash Zone)';
    if (x >= 6 && x <= 24 && y >= 34 && y <= 53) return 'Reading & Learning Room (Franco\'s Corner)';
    if (x >= 6 && x <= 24 && y >= 53 && y <= 76) return 'Character & Heritage Room';
    if (x >= 24 && x <= 38 && y >= 48 && y <= 60) return 'Stairs (To Level 2)';
    if (x >= 24 && x <= 38 && y >= 60 && y <= 76) return 'Staff Office (Under Stairs)';
    if (x >= 24 && x <= 76 && y >= 48 && y <= 77) return 'Central Function Hall';
    if (x >= 24 && x <= 76 && y >= 77 && y <= 92) return 'Main Entrance Foyer';
    if (y >= 92) return 'Main Entrance Ramp & Steps';
    return 'Ground Floor Gallery';
  }
}

function detectRoomZone(floor, pinX, pinY) {
  if (pinX == null || pinY == null) return '';
  const x = Number(pinX);
  const y = Number(pinY);
  if (floor === 2) {
    if (x >= 13 && x <= 49 && y >= 13 && y <= 48) return 'second_floor_toys';
    if (x >= 50 && x <= 87 && y >= 13 && y <= 48) return 'second_floor_carnival';
    return 'second_floor';
  } else {
    if (x >= 24 && x <= 76 && y >= 20 && y <= 48) return 'marine_story';
    if (x >= 76 && x <= 90 && y >= 33 && y <= 64) return 'splash_zone';
    if (x >= 6 && x <= 24 && y >= 34 && y <= 53) return 'reading_corner';
    if (x >= 6 && x <= 24 && y >= 53 && y <= 76) return 'maranon_heritage';
    if (x >= 24 && x <= 38 && y >= 60 && y <= 76) return 'staff_office';
    if (x >= 24 && x <= 76 && y >= 48 && y <= 77) return 'function_hall';
    if (x >= 24 && x <= 76 && y >= 77 && y <= 92) return 'entrance';
    return 'ground_floor';
  }
}

function getRoomCenterForCategory(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('toy')) {
    return { floor: 2, pinX: 31, pinY: 30, name: 'Toys & Collections Room' };
  }
  if (c.includes('carnival') || c.includes('discovery') || c.includes('play lab')) {
    return { floor: 2, pinX: 68, pinY: 30, name: 'Carnival & Discovery Room' };
  }
  if (c.includes('touch') || c.includes('splash')) {
    return { floor: 1, pinX: 83, pinY: 48, name: 'Touch & Play Room' };
  }
  if (c.includes('reading') || c.includes('learning')) {
    return { floor: 1, pinX: 15, pinY: 42, name: 'Reading & Learning Room' };
  }
  if (c.includes('character') || c.includes('heritage') || c.includes('hero')) {
    return { floor: 1, pinX: 15, pinY: 62, name: 'Character & Heritage Room' };
  }
  return { floor: 1, pinX: 50, pinY: 34, name: 'Marine & Nature Room' };
}

function renderMiniBlueprintSvg(floor) {
  if (floor === 2) {
    return `
      <svg viewBox="0 0 1000 1300" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; display:block;">
        <defs>
          <pattern id="miniCadGrid2" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(236,72,153,0.15)" stroke-width="0.9" />
          </pattern>
        </defs>
        <rect width="1000" height="1300" fill="#0d0414" />
        <rect width="1000" height="1300" fill="url(#miniCadGrid2)" />
        
        <!-- Outer Boundary Wall -->
        <rect x="70" y="60" width="860" height="1140" rx="14" fill="#0d0414" stroke="#ec4899" stroke-width="4.5" />
        
        <!-- Header banner -->
        <rect x="240" y="80" width="520" height="60" rx="10" fill="#3b0844" stroke="#ec4899" stroke-width="2.5" />
        <text x="500" y="118" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="19" fill="#f472b6">🪜 SECOND FLOOR (UPPER MEZZANINE LEVEL)</text>

        <!-- Stairs Landing (Down to Ground Floor) -->
        <g id="mini_zone_stairs2">
          <rect x="245" y="625" width="135" height="155" rx="5" fill="#1e0930" stroke="#f59e0b" stroke-width="3.5" />
          <line x1="245" y1="650" x2="380" y2="650" stroke="#f59e0b" stroke-width="2.5" />
          <line x1="245" y1="672" x2="380" y2="672" stroke="#f59e0b" stroke-width="2.5" />
          <line x1="245" y1="694" x2="380" y2="694" stroke="#f59e0b" stroke-width="2.5" />
          <line x1="245" y1="716" x2="380" y2="716" stroke="#f59e0b" stroke-width="2.5" />
          <line x1="245" y1="738" x2="380" y2="738" stroke="#f59e0b" stroke-width="2.5" />
          <path d="M 312 642 L 312 760 M 304 752 L 312 760 L 320 752" fill="none" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round" />
          <text x="312" y="795" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="12" fill="#fcd34d">▼ STAIRS DOWN</text>
          <text x="312" y="812" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10" font-weight="800" fill="#fde68a">To Ground Floor</text>
        </g>

        <!-- Toys & Collections Room (Hampanganan) -->
        <g id="mini_zone_toys">
          <rect x="135" y="175" width="350" height="445" rx="12" fill="#4a0b33" stroke="#ec4899" stroke-width="4.5" />
          <text x="310" y="235" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="18" fill="#fbcfe8">🧸 TOYS &amp; COLLECTIONS ROOM</text>
          <text x="310" y="260" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="13" fill="#f472b6">Hampanganan (Toy Room)</text>
          <rect x="165" y="310" width="130" height="65" rx="6" fill="rgba(236,72,153,0.25)" stroke="#ec4899" stroke-width="2" />
          <text x="230" y="348" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="11" font-weight="800" fill="#fbcfe8">Folk Toy Showcase</text>
          <rect x="325" y="310" width="130" height="65" rx="6" fill="rgba(236,72,153,0.25)" stroke="#ec4899" stroke-width="2" />
          <text x="390" y="348" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="11" font-weight="800" fill="#fbcfe8">McDonald's &amp; Beanies</text>
        </g>

        <!-- Carnival & Discovery Room -->
        <g id="mini_zone_carnival">
          <rect x="510" y="175" width="355" height="445" rx="12" fill="#3c0859" stroke="#a855f7" stroke-width="4.5" />
          <text x="685" y="235" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="18" fill="#e9d5ff">🎡 CARNIVAL &amp; DISCOVERY ROOM</text>
          <text x="685" y="260" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="13" fill="#c084fc">Discovery Room &amp; Hands-on Play Lab</text>
          <circle cx="610" cy="350" r="42" fill="rgba(168,85,247,0.25)" stroke="#a855f7" stroke-width="2.5" />
          <text x="610" y="355" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10.5" font-weight="800" fill="#e9d5ff">Game Hub</text>
          <circle cx="750" cy="350" r="42" fill="rgba(168,85,247,0.25)" stroke="#a855f7" stroke-width="2.5" />
          <text x="750" y="355" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10.5" font-weight="800" fill="#e9d5ff">Sensory Lab</text>
        </g>

        <!-- Mezzanine Balcony / Void Overlooking Function Hall -->
        <g id="mini_zone_mezzanine_void">
          <polygon points="140,620 860,620 860,1130 140,1130" fill="rgba(6,2,12,0.9)" stroke="#ec4899" stroke-width="3" stroke-dasharray="10,6" />
          <rect x="170" y="640" width="660" height="450" rx="8" fill="none" stroke="rgba(236,72,153,0.35)" stroke-width="2" />
          <text x="500" y="860" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="20" fill="#f472b6">👀 MEZZANINE VOID</text>
          <text x="500" y="890" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="14" fill="#fbcfe8">Open-to-Below Balcony Overlooking Function Hall</text>
        </g>
      </svg>
    `;
  }

  // Floor 1 (Ground Floor) - Exact Architectural Blueprint Matching map.html
  return `
    <svg viewBox="0 0 1000 1300" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; display:block;">
      <defs>
        <pattern id="miniCadGrid1" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,240,255,0.12)" stroke-width="0.9" />
        </pattern>
      </defs>
      <rect width="1000" height="1300" fill="#03131c" />
      <rect width="1000" height="1300" fill="url(#miniCadGrid1)" />

      <!-- Exterior Rain Water Reservoirs -->
      <g id="mini_reservoirs" opacity="0.85">
        <circle cx="830" cy="115" r="46" fill="rgba(0,229,255,0.06)" stroke="#00f0ff" stroke-width="2.5" stroke-dasharray="4,4" />
        <circle cx="830" cy="115" r="38" fill="none" stroke="#00f0ff" stroke-width="1.5" />
        <text x="830" y="112" text-anchor="middle" font-size="8" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="#5eead4">RAIN WATER</text>
        <text x="830" y="124" text-anchor="middle" font-size="8" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="#5eead4">RESERVOIR</text>

        <circle cx="835" cy="1000" r="46" fill="rgba(0,229,255,0.06)" stroke="#00f0ff" stroke-width="2.5" stroke-dasharray="4,4" />
        <circle cx="835" cy="1000" r="38" fill="none" stroke="#00f0ff" stroke-width="1.5" />
        <text x="835" y="997" text-anchor="middle" font-size="8" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="#5eead4">RAIN WATER</text>
        <text x="835" y="1009" text-anchor="middle" font-size="8" font-family="'IBM Plex Mono', monospace" font-weight="700" fill="#5eead4">RESERVOIR</text>
      </g>

      <!-- Exterior Concrete Gutter -->
      <line x1="240" y1="120" x2="760" y2="120" stroke="#00f0ff" stroke-width="3" stroke-dasharray="8,4" />
      <text x="500" y="108" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="10" font-weight="700" fill="#38bdf8">EXISTING CONCRETE GUTTER</text>

      <!-- Aquarium & Live Reef Section -->
      <g id="mini_zone_aquarium">
        <polygon points="240,135 760,135 760,265 240,265" fill="#032c3d" stroke="#00f0ff" stroke-width="4.5" />
        <line x1="320" y1="135" x2="320" y2="205" stroke="#00f0ff" stroke-width="3.5" />
        <line x1="320" y1="205" x2="600" y2="205" stroke="#00f0ff" stroke-width="3.5" />
        <path d="M 600 265 Q 580 240 560 265" fill="none" stroke="#5eead4" stroke-width="2.5" stroke-dasharray="4,3" />
        <text x="500" y="175" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="16" fill="#38bdf8">🐠 AQUARIUM &amp; LIVE REEF SYSTEMS</text>
        <text x="500" y="196" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="12" fill="#94a3b8">Tropical Saltwater Tanks &amp; Coral Habitats</text>
      </g>

      <!-- Marine & Nature Room (Flagship) -->
      <g id="mini_zone_marine">
        <polygon points="240,265 760,265 760,620 240,620" fill="#023040" stroke="#00f0ff" stroke-width="5" />
        <text x="500" y="302" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="18" fill="#e0f2fe">🌊 MARINE &amp; NATURE ROOM</text>
        <text x="500" y="324" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="12" fill="#7dd3fc">The Marine Story • Flagship Category Room (5 Exhibits Inside)</text>
        
        <line x1="470" y1="350" x2="600" y2="350" stroke="#00f0ff" stroke-width="3" />
        <line x1="600" y1="350" x2="600" y2="440" stroke="#00f0ff" stroke-width="3" />

        <rect x="340" y="375" width="150" height="44" rx="6" fill="rgba(0,240,255,0.18)" stroke="#00f0ff" stroke-width="2" />
        <text x="415" y="402" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="11" font-weight="800" fill="#7dd3fc">River Basin Area</text>

        <rect x="550" y="375" width="160" height="44" rx="6" fill="rgba(0,240,255,0.18)" stroke="#00f0ff" stroke-width="2" />
        <text x="630" y="402" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="11" font-weight="800" fill="#7dd3fc">Under the Sea Area</text>

        <rect x="390" y="500" width="220" height="32" rx="16" fill="rgba(0,240,255,0.22)" stroke="#00f0ff" stroke-width="1.8" />
        <text x="500" y="521" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="11" font-weight="900" fill="#ffffff">HOUSES 5 EXHIBITS INSIDE</text>

        <path d="M 460 620 Q 480 585 500 620" fill="none" stroke="#5eead4" stroke-width="3" stroke-dasharray="4,3" />
        <path d="M 540 620 Q 520 585 500 620" fill="none" stroke="#5eead4" stroke-width="3" stroke-dasharray="4,3" />
        <text x="500" y="610" text-anchor="middle" font-size="9.5" font-weight="900" fill="#5eead4">DOUBLE ENTRY DOORS</text>
      </g>

      <!-- Touch & Play Room (Splash Zone - East Wing) -->
      <g id="mini_zone_touch">
        <polygon points="760,440 895,440 895,820 760,820" fill="#0b5e58" stroke="#14b8a6" stroke-width="4.5" />
        <text x="828" y="475" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="16" fill="#5eead4">💦 TOUCH &amp; PLAY</text>
        <text x="828" y="495" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="11.5" fill="#ccfbf1">Splash Zone (Touch Pool)</text>

        <rect x="785" y="525" width="85" height="240" rx="10" fill="rgba(20,184,166,0.3)" stroke="#14b8a6" stroke-width="3" />
        <rect x="795" y="540" width="65" height="210" rx="6" fill="rgba(0,240,255,0.2)" stroke="#5eead4" stroke-width="2" stroke-dasharray="4,3" />
        <text x="828" y="640" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="11" fill="#99f6e4">TOUCH POOL</text>
        <text x="828" y="658" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="9.5" font-weight="700" fill="#99f6e4">Live Sea Life</text>
      </g>

      <!-- Library Extension Wing (West Wing) -->
      <g id="mini_zone_library_wing">
        <rect x="65" y="440" width="170" height="540" rx="6" fill="#1a0f02" stroke="#f59e0b" stroke-width="4" />
        
        <rect x="75" y="452" width="150" height="28" rx="5" fill="#f59e0b" />
        <text x="150" y="471" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="11" fill="#03131c">LIBRARY EXTENSION</text>

        <!-- Reading & Learning Room (Franco's Corner) -->
        <g id="mini_zone_reading">
          <rect x="72" y="490" width="156" height="185" rx="6" fill="rgba(59,130,246,0.25)" stroke="#3b82f6" stroke-width="2.5" />
          <text x="150" y="525" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="12" fill="#93c5fd">📚 READING &amp; LEARNING</text>
          <text x="150" y="546" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="10.5" fill="#bfdbfe">Franco's Reading Corner</text>
          <rect x="85" y="565" width="130" height="42" rx="4" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" stroke-width="1.5" />
          <text x="150" y="591" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10" font-weight="800" fill="#dbeafe">Children's Books &amp; Nook</text>
        </g>

        <!-- Divider -->
        <line x1="72" y1="685" x2="228" y2="685" stroke="rgba(245,158,11,0.5)" stroke-width="2" stroke-dasharray="4,4" />

        <!-- Character & Heritage Room -->
        <g id="mini_zone_heritage">
          <rect x="72" y="695" width="156" height="275" rx="6" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2.5" />
          <text x="150" y="730" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="12" fill="#fde68a">🏆 CHARACTER &amp; HERITAGE</text>
          <text x="150" y="750" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="10.5" fill="#fef08a">Governor Memorabilia</text>
          <text x="150" y="766" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="10.5" fill="#fef08a">&amp; Everyday Heroes</text>
          
          <rect x="85" y="790" width="130" height="45" rx="4" fill="rgba(245,158,11,0.3)" stroke="#f59e0b" stroke-width="1.5" />
          <text x="150" y="812" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10" font-weight="800" fill="#fef3c7">J.G. Marañon Section</text>
          <text x="150" y="826" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="8.5" font-weight="700" fill="#fef3c7">Gov. Memorial Gallery</text>

          <rect x="85" y="850" width="130" height="45" rx="4" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" stroke-width="1.5" />
          <text x="150" y="872" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="10" font-weight="800" fill="#fdba74">Everyday Heroes Section</text>
          <text x="150" y="886" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="8.5" font-weight="700" fill="#fdba74">Values Showcase</text>
        </g>
      </g>

      <!-- Function Hall -->
      <g id="mini_zone_hall">
        <polygon points="240,620 760,620 760,1000 240,1000" fill="#072b38" stroke="#00f0ff" stroke-width="3.5" />
        <text x="570" y="800" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="19" fill="#f8fafc">🏛️ FUNCTION HALL</text>
        <text x="570" y="825" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="13" fill="#7dd3fc">Main Assembly Hall &amp; Gathering Area</text>
      </g>

      <!-- Stairs to Level 2 -->
      <g id="mini_zone_stairs1">
        <rect x="245" y="625" width="135" height="155" rx="5" fill="#1b1704" stroke="#f59e0b" stroke-width="3.5" />
        <line x1="245" y1="650" x2="380" y2="650" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="245" y1="672" x2="380" y2="672" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="245" y1="694" x2="380" y2="694" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="245" y1="716" x2="380" y2="716" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="245" y1="738" x2="380" y2="738" stroke="#f59e0b" stroke-width="2.5" />
        <line x1="245" y1="760" x2="380" y2="760" stroke="#f59e0b" stroke-width="2.5" />
        <path d="M 312 755 L 312 642 M 304 650 L 312 642 L 320 650" fill="none" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round" />
        <rect x="258" y="700" width="108" height="24" rx="4" fill="rgba(27,23,4,0.92)" stroke="#f59e0b" stroke-width="1.2" />
        <text x="312" y="716" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="11" fill="#fcd34d">▲ STAIRS UP (L2)</text>
      </g>

      <!-- Staff Office (Inside Function Hall, Under Stairs, Beside J.G. Marañon Section) -->
      <g id="mini_zone_staff_office">
        <rect x="245" y="785" width="135" height="195" rx="6" fill="#092532" stroke="#00f0ff" stroke-width="3.5" />
        <rect x="255" y="795" width="115" height="24" rx="4" fill="rgba(0,240,255,0.18)" stroke="#00f0ff" stroke-width="1.2" />
        <text x="312" y="811" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="11" fill="#38bdf8">💼 STAFF OFFICE</text>
        <text x="312" y="830" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="8.5" font-weight="700" fill="#94a3b8">Administration</text>
        <text x="312" y="842" text-anchor="middle" font-size="8" font-weight="700" fill="#5eead4">Under-Stairs Wing</text>

        <rect x="258" y="856" width="48" height="30" rx="3" fill="rgba(0,240,255,0.1)" stroke="#5eead4" stroke-width="1.2" />
        <rect x="268" y="863" width="28" height="14" rx="2" fill="rgba(0,240,255,0.25)" stroke="#5eead4" stroke-width="1" />
        <circle cx="282" cy="894" r="4.5" fill="none" stroke="#94a3b8" stroke-width="1.2" />

        <rect x="320" y="856" width="48" height="30" rx="3" fill="rgba(0,240,255,0.1)" stroke="#5eead4" stroke-width="1.2" />
        <rect x="330" y="863" width="28" height="14" rx="2" fill="rgba(0,240,255,0.25)" stroke="#5eead4" stroke-width="1" />
        <circle cx="344" cy="894" r="4.5" fill="none" stroke="#94a3b8" stroke-width="1.2" />

        <text x="312" y="920" text-anchor="middle" font-size="8.5" font-weight="700" fill="#cbd5e1">Staff Workstations</text>
        <text x="312" y="933" text-anchor="middle" font-size="7.5" font-weight="600" fill="#64748b">&amp; Control Center</text>

        <path d="M 380 955 Q 355 955 355 980" fill="none" stroke="#5eead4" stroke-width="2.5" stroke-dasharray="4,3" />
        <text x="368" y="972" text-anchor="end" font-size="7.5" font-weight="700" fill="#5eead4">DOOR</text>
      </g>

      <!-- Main Entrance & Ramp -->
      <g id="mini_zone_entrance">
        <polygon points="240,1000 760,1000 760,1190 240,1190" fill="#052733" stroke="#00f0ff" stroke-width="3.5" />
        <path d="M 455 1190 Q 475 1145 500 1190" fill="none" stroke="#5eead4" stroke-width="3.5" stroke-dasharray="4,3" />
        <path d="M 545 1190 Q 525 1145 500 1190" fill="none" stroke="#5eead4" stroke-width="3.5" stroke-dasharray="4,3" />
        <text x="500" y="1080" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="20" fill="#5eead4">🚪 MAIN ENTRANCE</text>
        <text x="500" y="1108" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="700" font-size="13" fill="#94a3b8">Visitor Reception &amp; Ticketing Foyer</text>

        <rect x="360" y="1190" width="280" height="95" rx="4" fill="#00141c" stroke="#00f0ff" stroke-width="2.5" stroke-dasharray="6,4" />
        <line x1="360" y1="1215" x2="640" y2="1215" stroke="rgba(0,240,255,0.4)" stroke-width="2" />
        <line x1="360" y1="1240" x2="640" y2="1240" stroke="rgba(0,240,255,0.4)" stroke-width="2" />
        <line x1="360" y1="1265" x2="640" y2="1265" stroke="rgba(0,240,255,0.4)" stroke-width="2" />
        <text x="500" y="1255" text-anchor="middle" font-family="'Nunito',sans-serif" font-weight="900" font-size="12" fill="#7dd3fc">▲ ACCESS RAMP &amp; STEPS</text>
      </g>
    </svg>
  `;
}

// ─── Exhibit Edit/Create Modal (with map coordinates) ───
function openEditModal(id, defaultCategory){
  const ex = id ? exhibitsCache.find(x=>x.id===id) : null;
  const isEdit = Boolean(ex);
  let pendingImagePaths = ex ? (Array.isArray(ex.imagePaths) && ex.imagePaths.length ? [...ex.imagePaths] : (ex.imagePath ? [ex.imagePath] : [])) : [];
  let pendingMapImagePath = ex ? (ex.mapImagePath || '') : '';
  let videoUrl = ex && ex.videoUrl ? ex.videoUrl : '';

  let currentFloor = (ex && ex.floor === 2) ? 2 : (defaultCategory && (defaultCategory.toLowerCase().includes('toy') || defaultCategory.toLowerCase().includes('carnival')) ? 2 : 1);
  let currentPinX = (ex && ex.pinX !== null && ex.pinX !== undefined && !isNaN(Number(ex.pinX))) ? Number(ex.pinX) : null;
  let currentPinY = (ex && ex.pinY !== null && ex.pinY !== undefined && !isNaN(Number(ex.pinY))) ? Number(ex.pinY) : null;
  if (!isEdit && currentPinX === null && defaultCategory) {
    const center = getRoomCenterForCategory(defaultCategory);
    currentFloor = center.floor;
    currentPinX = center.pinX;
    currentPinY = center.pinY;
  }

  openModal(`
    <h2>${isEdit ? 'Edit exhibit' : 'Add exhibit'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title *</label><input type="text" id="ex-title" value="${ex?escapeHtml(ex.title):''}" placeholder="e.g. Giant Clam Shell" required></div>
      <div class="form-field"><label>Category *</label><select id="ex-category"><option value="">Select</option>${categoriesCache.map(c=>`<option value="${escapeHtml(c)}" ${ex && ex.category===c?'selected':''} ${defaultCategory && !ex && c===defaultCategory?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Origin</label><input type="text" id="ex-origin" value="${ex?escapeHtml(ex.origin):''}" placeholder="e.g. Philippines"></div>
      <div class="form-field"><label>Year</label><input type="text" id="ex-year" value="${ex?escapeHtml(ex.year):''}" placeholder="e.g. 2020"></div>
      <div class="form-field"><label>Location (display name)</label><input type="text" id="ex-location" value="${ex?escapeHtml(ex.location):''}" placeholder="e.g. Marine & Nature Room • Coral Reef Section"></div>
      <div class="form-field full">
        <label>Walking Directions (Floor Plan Navigation)</label>
        <textarea id="ex-directions" rows="2" placeholder="e.g. From the Main Entrance, turn right into the East Wing corridor and enter the first door on the right into the Touch &amp; Play Room.">${ex?escapeHtml(typeof ex.directions === 'object' && ex.directions !== null ? (ex.directions.en || '') : (ex.directions || '')):''}</textarea>
        <div class="file-hint">Tell visitors clearly how to reach this exhibit from the entrance based on the floor plan.</div>
      </div>
      <div class="form-field"><label>Latitude (map)</label><input type="number" step="0.000001" id="ex-lat" value="${ex && ex.lat !== null && ex.lat !== undefined ? ex.lat : ''}" placeholder="e.g. 10.945678"></div>
      <div class="form-field"><label>Longitude (map)</label><input type="number" step="0.000001" id="ex-lng" value="${ex && ex.lng !== null && ex.lng !== undefined ? ex.lng : ''}" placeholder="e.g. 123.421345"></div>

      <!-- Interactive Floor Plan Pinpoint Picker -->
      <div class="form-field full floor-picker-section">
        <div class="floor-picker-header">
          <h4 class="floor-picker-title">
            <span>📍 Architectural Floor Plan Pinpoint</span>
            <span style="font-size:11px; font-weight:600; color:#94a3b8;">(Click anywhere on map to drop or move exhibit pin)</span>
          </h4>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost dark btn-small active" id="btnToggleOtherPins" style="font-size:11px; padding:4px 9px; display:inline-flex; align-items:center; gap:5px;" title="Toggle seeing all other existing exhibit pins on this floor">
              <span>👁️ All Pins (<span id="otherPinsCountNum">0</span>)</span>
            </button>
            <div class="floor-toggle-group">
              <button type="button" class="btn-floor-toggle ${currentFloor === 1 ? 'active' : ''}" id="exFloor1Btn">Level 1 (Ground)</button>
              <button type="button" class="btn-floor-toggle ${currentFloor === 2 ? 'active' : ''}" id="exFloor2Btn">Level 2 (Mezzanine)</button>
            </div>
          </div>
        </div>

        <div class="floor-picker-viewport" id="exFloorViewport" title="Click anywhere on the floor map to pinpoint this exhibit">
          <div class="floor-picker-svg-wrap" id="exFloorSvgWrap"></div>
          <div class="floor-picker-other-pins-wrap" id="exFloorOtherPinsWrap"></div>
          <div class="floor-picker-pin current-active-pin" id="exFloorPin" style="${currentPinX !== null && currentPinY !== null ? `left:${currentPinX}%; top:${currentPinY}%; display:flex;` : 'display:none;'}">
            <div class="current-pin-radar-ring"></div>
            <div class="picker-pin-icon">📍</div>
            <div class="picker-pin-badge" id="exFloorPinBadge">${escapeHtml(ex ? ex.title || 'Exhibit' : 'New Exhibit')} (Selected)</div>
          </div>
        </div>

        <!-- Informative Visual Pinpoint Legend -->
        <div class="floor-picker-legend">
          <div class="floor-picker-legend-item">
            <span class="legend-dot active"></span>
            <span style="color:#ffffff; font-weight:700;">Active Selected Pin</span>
            <span style="color:#94a3b8;">(Click map to drop or reposition)</span>
          </div>
          <div class="floor-picker-legend-item">
            <span class="legend-dot other"></span>
            <span style="color:#38bdf8; font-weight:700;">Existing Exhibit Pins</span>
            <span style="color:#94a3b8;">(Reference locations on this floor)</span>
          </div>
        </div>

        <div class="floor-picker-footer">
          <div class="pin-coords-badge" id="exPinCoordsBadge">
            ${currentPinX !== null && currentPinY !== null ? `Floor: <strong>L${currentFloor}</strong> • Pin: <strong>X: ${Math.round(currentPinX)}%, Y: ${Math.round(currentPinY)}%</strong> • <span class="room-tag">${detectRoomFromCoords(currentFloor, currentPinX, currentPinY)}</span>` : '<span style="color:#94a3b8;">No pin placed yet. Click anywhere on the map above to drop a pinpoint.</span>'}
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="btn btn-ghost dark btn-small" id="btnAutoPinToRoom" title="Automatically place pinpoint in center of selected category room">Snap to Room Center</button>
            <button type="button" class="btn btn-danger btn-small" id="btnClearPin" style="${currentPinX !== null && currentPinY !== null ? '' : 'display:none;'}">Clear Pin</button>
          </div>
        </div>
      </div>
      
      <!-- Video Section (YouTube link or MP4/WebM Upload - Same as Gallery) -->
      <div class="form-field full">
        <label>Video (optional — YouTube link or upload MP4/WebM video)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="ex-video" value="${escapeHtml(videoUrl)}" placeholder="e.g. https://www.youtube.com/watch?v=... or upload video" style="flex:1;">
          <button type="button" class="btn btn-ghost dark btn-small" id="ex-upload-video-btn">Upload video</button>
          <button type="button" class="btn btn-danger btn-small" id="ex-clear-video-btn" style="${videoUrl ? '' : 'display:none;'}">Clear</button>
          <input type="file" id="ex-video-file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display:none;">
        </div>
        <div id="exVideoStatus" style="font-size:12px; color:var(--ink-soft); margin-top:4px;"></div>
        <div id="exVideoPreview"></div>
      </div>

      <!-- Photos Section (Multiple Photos Swipeable Album - Same as Gallery) -->
      <div class="form-field full">
        <label>Photos (you can select multiple for a swipeable album)</label>
        <input type="file" id="ex-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
        <div class="file-drop" id="ex-drop">Click or drop photos here (select multiple to create a swipeable album)</div>
        <div class="file-hint">Tip: you can hold Ctrl/Cmd or Shift to select multiple photos at once.</div>
        <div class="image-preview-list" id="exImagePreviewList"></div>
        <div id="exUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>

      <div class="form-field full">
        <label>Floor Plan / Direction Map (optional)</label>
        <input type="file" id="ex-map-file" accept="image/png,image/jpeg,image/webp" style="display:none;">
        <div class="file-drop" id="ex-map-drop">Click or drop floor plan image here (shows visitor where to find exhibit)</div>
        <div class="file-hint">Upload a floor plan snippet or map image showing exhibit location (e.g. 2nd floor plan with red dot)</div>
        <div class="image-preview-list" id="exMapPreviewList"></div>
        <div id="exMapUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>

      <div class="form-field full">
        <label>Description (EN)</label>
        <textarea id="ex-desc" rows="3" placeholder="Detailed description in English">${ex?escapeHtml(ex.description):''}</textarea>
      </div>
      <div class="form-field full">
        <label>Description (Tagalog)</label>
        <textarea id="ex-desc_tl" rows="2" placeholder="Paglalarawan sa Tagalog">${ex?escapeHtml(ex.description_tl):''}</textarea>
      </div>
      <div class="form-field full">
        <label>Description (Cebuano)</label>
        <textarea id="ex-desc_cb" rows="2" placeholder="Paglalarawan sa Cebuano">${ex?escapeHtml(ex.description_cb):''}</textarea>
      </div>
      <div class="form-error" id="exError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="exCancel">Cancel</button>
      <button class="btn btn-primary" id="exSave">${isEdit ? 'Save changes' : 'Add exhibit'}</button>
    </div>
  `);

  ensureMultipleInput('ex-image-file');
  renderImagePreviewList(pendingImagePaths, 'exImagePreviewList');
  if (pendingImagePaths.length) {
    const status = document.getElementById('exUploadStatus');
    if (status) status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
  }

  // ── Video Controls & Live Preview ──
  const exVideoBtn = document.getElementById('ex-upload-video-btn');
  const exVideoFile = document.getElementById('ex-video-file');
  const exVideoInput = document.getElementById('ex-video');
  const exVideoStatus = document.getElementById('exVideoStatus');
  const exClearVideoBtn = document.getElementById('ex-clear-video-btn');
  const exVideoPreview = document.getElementById('exVideoPreview');

  function refreshVideoPreview() {
    const val = (exVideoInput.value || '').trim();
    if (exClearVideoBtn) exClearVideoBtn.style.display = val ? '' : 'none';
    if (!exVideoPreview) return;
    if (!val) {
      exVideoPreview.innerHTML = '';
      return;
    }
    if (typeof window.parseVideoUrl === 'function') {
      const parsed = window.parseVideoUrl(val);
      if (parsed) {
        if (parsed.type === 'youtube') {
          exVideoPreview.innerHTML = `
            <div style="margin-top:8px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); aspect-ratio:16/9; max-height:180px; background:#000;">
              <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(parsed.id)}" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>
            </div>`;
          return;
        }
        if (parsed.type === 'direct') {
          exVideoPreview.innerHTML = `
            <div style="margin-top:8px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); max-height:180px; background:#000;">
              <video src="${escapeHtml(parsed.url)}" controls style="width:100%; max-height:180px; border-radius:12px; display:block;"></video>
            </div>`;
          return;
        }
      }
    }
    exVideoPreview.innerHTML = `<div style="margin-top:6px; font-size:12px; color:#5eead4; display:flex; align-items:center; gap:6px;"><span>▶</span> Video source: <code>${escapeHtml(val)}</code></div>`;
  }

  refreshVideoPreview();
  exVideoInput.addEventListener('input', refreshVideoPreview);

  if (exClearVideoBtn) {
    exClearVideoBtn.addEventListener('click', () => {
      exVideoInput.value = '';
      if (exVideoFile) exVideoFile.value = '';
      if (exVideoStatus) exVideoStatus.textContent = '';
      refreshVideoPreview();
    });
  }

  if(exVideoBtn && exVideoFile){
    exVideoBtn.addEventListener('click', ()=>exVideoFile.click());
    exVideoFile.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      exVideoStatus.textContent = 'Uploading video… (this may take a few moments)';
      try{
        const { path } = await Api.uploadMedia(file);
        exVideoInput.value = path;
        exVideoStatus.textContent = 'Video uploaded successfully!';
        refreshVideoPreview();
      }catch(err){ exVideoStatus.textContent = 'Upload failed: ' + err.message; }
    });
  }

  // ── Multiple Photos Upload (Drag & Drop + Multi-select) ──
  const exInput = document.getElementById('ex-image-file');
  const exDrop = document.getElementById('ex-drop');
  if(exDrop){
    exDrop.addEventListener('click', ()=>exInput.click());
    exDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); exDrop.classList.add('dragover'); });
    exDrop.addEventListener('dragleave', ()=>exDrop.classList.remove('dragover'));
    exDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); exDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const status = document.getElementById('exUploadStatus');
      status.textContent = 'Uploading…';
      try{
        for(const file of files){
          const { path } = await Api.uploadImage(file);
          pendingImagePaths.push(path);
        }
        renderImagePreviewList(pendingImagePaths, 'exImagePreviewList');
        status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }

  exInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    const status = document.getElementById('exUploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        pendingImagePaths.push(path);
      }
      renderImagePreviewList(pendingImagePaths, 'exImagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
      e.target.value = '';
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });

  // Map image upload
  const exMapInput = document.getElementById('ex-map-file');
  const exMapDrop = document.getElementById('ex-map-drop');
  if(exMapDrop){
    exMapDrop.addEventListener('click', ()=>exMapInput.click());
    exMapDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); exMapDrop.classList.add('dragover'); });
    exMapDrop.addEventListener('dragleave', ()=>exMapDrop.classList.remove('dragover'));
    exMapDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); exMapDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const file = files[0];
      const status = document.getElementById('exMapUploadStatus');
      status.textContent = 'Uploading map…';
      try{
        const { path } = await Api.uploadImage(file);
        pendingMapImagePath = path;
        renderImagePreviewList([path], 'exMapPreviewList');
        status.textContent = 'Map uploaded successfully.';
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }

  exMapInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = document.getElementById('exMapUploadStatus');
    status.textContent = 'Uploading map…';
    try{
      const { path } = await Api.uploadImage(file);
      pendingMapImagePath = path;
      renderImagePreviewList([path], 'exMapPreviewList');
      status.textContent = 'Map uploaded successfully.';
      e.target.value = '';
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });

  // ── Floor Plan Pinpoint Picker Interactive Logic ──
  const exFloorSvgWrap = document.getElementById('exFloorSvgWrap');
  const exFloorViewport = document.getElementById('exFloorViewport');
  const exFloorOtherPinsWrap = document.getElementById('exFloorOtherPinsWrap');
  const exFloorPin = document.getElementById('exFloorPin');
  const exFloorPinBadge = document.getElementById('exFloorPinBadge');
  const exPinCoordsBadge = document.getElementById('exPinCoordsBadge');
  const exFloor1Btn = document.getElementById('exFloor1Btn');
  const exFloor2Btn = document.getElementById('exFloor2Btn');
  const btnToggleOtherPins = document.getElementById('btnToggleOtherPins');
  const otherPinsCountNum = document.getElementById('otherPinsCountNum');
  const btnAutoPinToRoom = document.getElementById('btnAutoPinToRoom');
  const btnClearPin = document.getElementById('btnClearPin');

  let showOtherPins = true;

  function updatePinUi() {
    if (exFloorSvgWrap) exFloorSvgWrap.innerHTML = renderMiniBlueprintSvg(currentFloor);
    if (exFloor1Btn) exFloor1Btn.classList.toggle('active', currentFloor === 1);
    if (exFloor2Btn) exFloor2Btn.classList.toggle('active', currentFloor === 2);

    // Filter all other exhibits on this floor
    const otherExhibits = (exhibitsCache || []).filter(item => {
      if (ex && (item.id === ex.id || (ex.code && item.code === ex.code))) return false;
      const f = item.floor === 2 ? 2 : 1;
      return f === currentFloor &&
             item.pinX !== null && item.pinX !== undefined && !isNaN(Number(item.pinX)) &&
             item.pinY !== null && item.pinY !== undefined && !isNaN(Number(item.pinY));
    });

    if (otherPinsCountNum) {
      otherPinsCountNum.textContent = otherExhibits.length;
    }

    if (exFloorOtherPinsWrap) {
      if (showOtherPins && otherExhibits.length > 0) {
        exFloorOtherPinsWrap.innerHTML = otherExhibits.map(item => {
          const itemTitle = item.title || 'Exhibit';
          const itemCode = item.code ? `${item.code}: ` : '';
          const label = `${itemCode}${itemTitle}`;
          return `
            <div class="floor-picker-pin other-pin" style="left:${item.pinX}%; top:${item.pinY}%;" title="${escapeHtml(label)} (${Math.round(item.pinX)}%, ${Math.round(item.pinY)}%)">
              <div class="other-pin-icon">📍</div>
              <div class="other-pin-badge">${escapeHtml(label)}</div>
            </div>
          `;
        }).join('');
      } else {
        exFloorOtherPinsWrap.innerHTML = '';
      }
    }

    if (btnToggleOtherPins) {
      btnToggleOtherPins.classList.toggle('active', showOtherPins);
    }

    if (currentPinX !== null && currentPinY !== null) {
      if (exFloorPin) {
        exFloorPin.style.left = `${currentPinX}%`;
        exFloorPin.style.top = `${currentPinY}%`;
        exFloorPin.style.display = 'flex';
      }
      const titleText = (document.getElementById('ex-title')?.value || (ex ? ex.title : '') || 'New Exhibit').trim();
      if (exFloorPinBadge) {
        exFloorPinBadge.textContent = `${titleText} (Selected)`;
      }
      const roomName = detectRoomFromCoords(currentFloor, currentPinX, currentPinY);
      if (exPinCoordsBadge) {
        exPinCoordsBadge.innerHTML = `Floor: <strong>L${currentFloor}</strong> • Pin: <strong>X: ${Math.round(currentPinX)}%, Y: ${Math.round(currentPinY)}%</strong> • <span class="room-tag">${escapeHtml(roomName)}</span>`;
      }
      if (btnClearPin) btnClearPin.style.display = 'inline-block';
    } else {
      if (exFloorPin) exFloorPin.style.display = 'none';
      if (exPinCoordsBadge) {
        exPinCoordsBadge.innerHTML = `<span style="color:#94a3b8;">No pin placed yet. Click anywhere on the map above to drop a pinpoint.</span>`;
      }
      if (btnClearPin) btnClearPin.style.display = 'none';
    }
  }

  updatePinUi();

  // If exhibitsCache is empty, fetch fresh exhibits and re-render pins
  if (!exhibitsCache || exhibitsCache.length === 0) {
    Api.listExhibits().then(res => {
      if (res && Array.isArray(res.exhibits)) {
        exhibitsCache = res.exhibits;
        updatePinUi();
      }
    }).catch(() => {});
  }

  if (btnToggleOtherPins) {
    btnToggleOtherPins.addEventListener('click', () => {
      showOtherPins = !showOtherPins;
      updatePinUi();
    });
  }

  if (exFloor1Btn) {
    exFloor1Btn.addEventListener('click', () => {
      currentFloor = 1;
      updatePinUi();
    });
  }
  if (exFloor2Btn) {
    exFloor2Btn.addEventListener('click', () => {
      currentFloor = 2;
      updatePinUi();
    });
  }

  if (exFloorViewport) {
    exFloorViewport.addEventListener('click', (e) => {
      const rect = exFloorViewport.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      let pctX = Math.round(((clickX / rect.width) * 100) * 10) / 10;
      let pctY = Math.round(((clickY / rect.height) * 100) * 10) / 10;
      pctX = Math.max(2, Math.min(98, pctX));
      pctY = Math.max(2, Math.min(98, pctY));
      currentPinX = pctX;
      currentPinY = pctY;
      updatePinUi();

      const locInput = document.getElementById('ex-location');
      if (locInput && !locInput.value.trim()) {
        locInput.value = `${detectRoomFromCoords(currentFloor, currentPinX, currentPinY)}`;
      }
    });
  }

  if (btnAutoPinToRoom) {
    btnAutoPinToRoom.addEventListener('click', () => {
      const selectedCat = document.getElementById('ex-category').value;
      const center = getRoomCenterForCategory(selectedCat);
      currentFloor = center.floor;
      currentPinX = center.pinX;
      currentPinY = center.pinY;
      updatePinUi();
      toast(`Pinned to ${center.name}`);
    });
  }

  if (btnClearPin) {
    btnClearPin.addEventListener('click', () => {
      currentPinX = null;
      currentPinY = null;
      updatePinUi();
      toast('Pinpoint cleared');
    });
  }

  const titleInput = document.getElementById('ex-title');
  if (titleInput && exFloorPinBadge) {
    titleInput.addEventListener('input', () => {
      exFloorPinBadge.textContent = `${titleInput.value.trim() || 'New Exhibit'} (Selected)`;
    });
  }

  const catSelect = document.getElementById('ex-category');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      if (currentPinX === null && catSelect.value) {
        const center = getRoomCenterForCategory(catSelect.value);
        currentFloor = center.floor;
        currentPinX = center.pinX;
        currentPinY = center.pinY;
        updatePinUi();
      }
    });
  }

  document.getElementById('exCancel').addEventListener('click', closeModal);
  document.getElementById('exSave').addEventListener('click', async ()=>{
    const errorEl = document.getElementById('exError');
    const title = document.getElementById('ex-title').value.trim();
    if(!title){ errorEl.textContent = 'Title is required.'; return; }
    const category = document.getElementById('ex-category').value;
    if(!category){ errorEl.textContent = 'Category is required.'; return; }
    const lat = document.getElementById('ex-lat').value;
    const lng = document.getElementById('ex-lng').value;
    const latNum = lat === '' ? null : parseFloat(lat);
    const lngNum = lng === '' ? null : parseFloat(lng);
    if((latNum !== null && isNaN(latNum)) || (lngNum !== null && isNaN(lngNum))){ errorEl.textContent = 'Invalid coordinates.'; return; }

    const payload = {
      title,
      category,
      origin: document.getElementById('ex-origin').value.trim(),
      year: document.getElementById('ex-year').value.trim(),
      location: document.getElementById('ex-location').value.trim(),
      directions: document.getElementById('ex-directions') ? document.getElementById('ex-directions').value.trim() : '',
      lat: latNum,
      lng: lngNum,
      floor: currentFloor,
      pinX: currentPinX !== null ? currentPinX : null,
      pinY: currentPinY !== null ? currentPinY : null,
      mapZone: detectRoomZone(currentFloor, currentPinX, currentPinY),
      mapImagePath: pendingMapImagePath,
      description: document.getElementById('ex-desc').value.trim(),
      description_tl: document.getElementById('ex-desc_tl').value.trim(),
      description_cb: document.getElementById('ex-desc_cb').value.trim(),
      imagePaths: pendingImagePaths,
      imagePath: pendingImagePaths[0] || '',
      videoUrl: exVideoInput.value.trim()
    };

    try{
      if(isEdit){
        await Api.updateExhibit(ex.id, payload);
        toast('Exhibit updated');
      } else {
        await Api.createExhibit(payload);
        toast('Exhibit added');
      }
      closeModal();
      renderDashboard();
    }catch(err){ errorEl.textContent = err.message; }
  });
}

async function renderCategoriesTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading categories…</p></div>`;
  try{
    const [catRes, exRes] = await Promise.all([
      Api.listCategories(),
      exhibitsCache.length ? Promise.resolve({ exhibits: exhibitsCache }) : Api.listExhibits().catch(()=>({ exhibits: [] }))
    ]);
    const rawCategories = Array.isArray(catRes.categories) ? catRes.categories : [];
    if(exRes && Array.isArray(exRes.exhibits)) exhibitsCache = exRes.exhibits;
    
    categoriesCache = Array.from(new Set([
      ...rawCategories,
      ...exhibitsCache.map(e => String(e.category || 'Other').trim()).filter(Boolean)
    ]));
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load categories</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  // Count exhibits per category
  const counts = {};
  for(const ex of exhibitsCache){
    const cat = (ex.category || 'Other').trim();
    counts[cat] = (counts[cat] || 0) + 1;
  }

  let filteredCategories = [...categoriesCache];
  if(adminCategorySearch){
    const q = adminCategorySearch.toLowerCase();
    filteredCategories = filteredCategories.filter(c => c.toLowerCase().includes(q));
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminCategorySearchInput" class="admin-search-input" placeholder="Search categories…" value="${escapeHtml(adminCategorySearch)}">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; color:var(--ink-soft);">${filteredCategories.length} of ${categoriesCache.length} categor${categoriesCache.length===1 ? 'y' : 'ies'}</span>
          <button class="btn btn-primary btn-small" id="addCategoryBtn">+ Add category</button>
        </div>
      </div>
    </div>
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead><tr><th>Category</th><th>Assigned Exhibits</th><th></th></tr></thead>
        <tbody id="categoriesBody"></tbody>
      </table>
    </div>
    ${filteredCategories.length===0 ? `<div class="empty-state"><h2>No matching categories</h2><p>No categories found matching "${escapeHtml(adminCategorySearch)}".</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminCategorySearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminCategorySearch = e.target.value.trim();
      renderCategoriesTab(contentEl);
      const updated = document.getElementById('adminCategorySearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  const tbody = document.getElementById('categoriesBody');
  tbody.innerHTML = filteredCategories.map((cat, idx) => {
    const count = counts[cat] || 0;
    return `
      <tr>
        <td class="title-cell" data-label="Category">
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <span class="cat-pill">${escapeHtml(cat)}</span>
          </span>
        </td>
        <td data-label="Assigned Exhibits">
          <a href="javascript:void(0)" class="cat-count-link" data-view-cat="${escapeHtml(cat)}" title="Click to view exhibits in catalog" style="font-size:12.5px; color:var(--ink-soft); text-decoration:underline;">
            ${count} exhibit${count === 1 ? '' : 's'}
          </a>
        </td>
        <td data-label="Actions">
          <div class="row-actions">
            <button class="btn btn-primary btn-small" data-add-to-cat="${escapeHtml(cat)}" title="Add an exhibit directly to this category">+ Add exhibit</button>
            <button class="btn btn-ghost dark btn-small" data-manage-cat="${escapeHtml(cat)}" title="Assign/move existing exhibits into this category">Assign</button>
            <button class="btn btn-ghost dark btn-small" data-rename-cat="${escapeHtml(cat)}">Rename</button>
            <button class="btn btn-danger btn-small" data-delete-cat="${escapeHtml(cat)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('addCategoryBtn').addEventListener('click', ()=>openCategoryModal());

  tbody.querySelectorAll('[data-view-cat]').forEach(link=>{
    link.addEventListener('click', ()=>{
      adminCatalogCategory = link.dataset.viewCat;
      activeTab = 'catalog';
      renderDashboard();
    });
  });

  tbody.querySelectorAll('[data-add-to-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openEditModal(null, btn.dataset.addToCat);
    });
  });

  tbody.querySelectorAll('[data-manage-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openAssignExhibitsModal(btn.dataset.manageCat);
    });
  });

  tbody.querySelectorAll('[data-rename-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openCategoryModal(btn.dataset.renameCat);
    });
  });

  tbody.querySelectorAll('[data-delete-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cat = btn.dataset.deleteCat;
      const count = counts[cat] || 0;
      openDeleteCategoryModal(cat, count);
    });
  });
}

function openAssignExhibitsModal(category){
  const cat = String(category || '').trim();
  const currentAssigned = new Set(exhibitsCache.filter(e => String(e.category || '').trim().toLowerCase() === cat.toLowerCase()).map(e => e.id));
  let selectedIds = new Set(currentAssigned);

  const renderList = (filterText = '') => {
    const listEl = document.getElementById('assignList');
    if (!listEl) return;
    const lower = filterText.toLowerCase();
    const matches = exhibitsCache.filter(e => !lower || (e.title || '').toLowerCase().includes(lower) || (e.code || '').toLowerCase().includes(lower) || (e.category || '').toLowerCase().includes(lower));
    
    if (matches.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--ink-soft); font-size:13px;">No exhibits found matching "${escapeHtml(filterText)}"</div>`;
      return;
    }

    listEl.innerHTML = matches.map(ex => {
      const isChecked = selectedIds.has(ex.id);
      return `
        <label class="assign-exhibit-row ${isChecked ? 'selected' : ''}" data-id="${ex.id}">
          <div class="assign-exhibit-left">
            <input type="checkbox" data-exhibit-checkbox="${ex.id}" ${isChecked ? 'checked' : ''}>
            <div class="assign-exhibit-info">
              <div class="assign-exhibit-title">${escapeHtml(ex.title)}</div>
              <div class="assign-exhibit-code">${ex.code}</div>
            </div>
          </div>
          <span class="cat-pill" style="font-size:10px;">${escapeHtml(ex.category || 'Other')}</span>
        </label>
      `;
    }).join('');

    listEl.querySelectorAll('[data-exhibit-checkbox]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.dataset.exhibitCheckbox;
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        cb.closest('.assign-exhibit-row')?.classList.toggle('selected', cb.checked);
        updateSelectedCount();
      });
    });
  };

  const updateSelectedCount = () => {
    const countEl = document.getElementById('assignSelectedCount');
    if (countEl) countEl.textContent = `${selectedIds.size} exhibit${selectedIds.size === 1 ? '' : 's'} selected`;
  };

  openModal(`
    <h2>Assign exhibits to "${escapeHtml(cat)}"</h2>
    <p style="font-size:13px; color:var(--ink-soft); margin:-10px 0 12px; line-height:1.4;">
      Check the exhibits you want in <strong>${escapeHtml(cat)}</strong>.
    </p>
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
      <input type="text" id="assignSearch" placeholder="Search exhibits…" style="flex:1; padding:7px 10px; font-size:13px; border-radius:8px; border:1px solid var(--parchment-3);">
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn btn-ghost dark btn-small" id="assignSelectAll" style="padding:4px 8px; font-size:11.5px;">Select all</button>
        <button type="button" class="btn btn-ghost dark btn-small" id="assignClear" style="padding:4px 8px; font-size:11.5px;">Clear</button>
      </div>
    </div>
    <div class="assign-exhibits-list" id="assignList"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
      <span style="font-size:12px; color:var(--ink-soft);" id="assignSelectedCount"></span>
      <div class="form-error" id="assignError" style="font-size:12px;"></div>
    </div>
    <div class="modal-actions" style="margin-top:16px;">
      <button class="btn btn-ghost dark" id="cancelAssign">Cancel</button>
      <button class="btn btn-primary" id="saveAssign">Save assignments</button>
    </div>
  `);

  renderList();
  updateSelectedCount();

  document.getElementById('assignSearch').addEventListener('input', (e) => renderList(e.target.value.trim()));
  document.getElementById('assignSelectAll').addEventListener('click', () => {
    exhibitsCache.forEach(e => selectedIds.add(e.id));
    renderList(document.getElementById('assignSearch').value.trim());
    updateSelectedCount();
  });
  document.getElementById('assignClear').addEventListener('click', () => {
    selectedIds.clear();
    renderList(document.getElementById('assignSearch').value.trim());
    updateSelectedCount();
  });

  document.getElementById('cancelAssign').addEventListener('click', closeModal);

  const saveBtn = document.getElementById('saveAssign');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await Api.assignExhibitsToCategory(cat, Array.from(selectedIds));
      closeModal();
      toast(`${selectedIds.size} exhibit${selectedIds.size === 1 ? '' : 's'} assigned to "${cat}"`);
      await loadCategories();
      const { exhibits } = await Api.listExhibits().catch(() => ({ exhibits: [] }));
      if (Array.isArray(exhibits)) exhibitsCache = exhibits;
      renderDashboard();
    } catch (err) {
      document.getElementById('assignError').textContent = err.message;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save assignments';
    }
  });
}

function openCategoryModal(category){
  const isEdit = Boolean(category);
  openModal(`
    <h2>${isEdit ? 'Rename category' : 'Add category'}</h2>
    <div class="form-grid">
      <div class="form-field full">
        <label>${isEdit ? 'New category name' : 'Category name'}</label>
        <input type="text" id="catName" value="${isEdit ? escapeHtml(category) : ''}" placeholder="e.g. Science & Space">
      </div>
      <div class="form-error" id="catError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="cancelCategory">Cancel</button>
      <button class="btn btn-primary" id="saveCategory">${isEdit ? 'Rename' : 'Add'}</button>
    </div>`);

  const input = document.getElementById('catName');
  setTimeout(()=>{ if(input){ input.focus(); input.select(); } }, 50);

  document.getElementById('cancelCategory').addEventListener('click', closeModal);

  const saveBtn = document.getElementById('saveCategory');
  const doSave = async ()=>{
    const newName = input.value.trim();
    const errorEl = document.getElementById('catError');
    errorEl.textContent = '';
    if(!newName){
      errorEl.textContent = 'Category name is required.';
      input.focus();
      return;
    }
    if(isEdit && newName.toLowerCase() === category.toLowerCase() && newName === category){
      closeModal();
      return;
    }
    if(categoriesCache.some(c => c.toLowerCase() === newName.toLowerCase() && (!isEdit || c.toLowerCase() !== category.toLowerCase()))){
      errorEl.textContent = `A category named "${newName}" already exists.`;
      input.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? 'Renaming…' : 'Adding…';
    try{
      if(isEdit){
        await Api.renameCategory(category, newName);
        toast(`Category renamed to "${newName}"`);
      } else {
        await Api.createCategory(newName);
        toast(`Category "${newName}" added`);
      }
      closeModal();
      await loadCategories();
      const { exhibits } = await Api.listExhibits().catch(()=>({ exhibits: [] }));
      if(Array.isArray(exhibits)) exhibitsCache = exhibits;
      renderDashboard();
    }catch(e){
      errorEl.textContent = e.message;
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Rename' : 'Add';
    }
  };

  saveBtn.addEventListener('click', doSave);
  input.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); doSave(); } });
}

function openDeleteCategoryModal(category, count){
  openModal(`
    <h2>Delete category "${escapeHtml(category)}"?</h2>
    <p style="font-size:13.5px; color:var(--ink-soft); margin:-8px 0 16px; line-height:1.5;">
      ${count > 0 
        ? `There ${count === 1 ? 'is 1 exhibit' : `are ${count} exhibits`} in this category. Deleting it will move ${count === 1 ? 'it' : 'them'} to "Other".`
        : 'No exhibits are currently assigned to this category.'}
    </p>
    <div class="form-error" id="delCatError" style="margin-bottom:12px;"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="cancelDelCat">Cancel</button>
      <button class="btn btn-danger" id="confirmDelCat">Delete category</button>
    </div>
  `);

  document.getElementById('cancelDelCat').addEventListener('click', closeModal);
  const confirmBtn = document.getElementById('confirmDelCat');
  confirmBtn.addEventListener('click', async ()=>{
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';
    try{
      await Api.deleteCategory(category);
      closeModal();
      toast(`Category "${category}" deleted`);
      await loadCategories();
      const { exhibits } = await Api.listExhibits().catch(()=>({ exhibits: [] }));
      if(Array.isArray(exhibits)) exhibitsCache = exhibits;
      renderDashboard();
    }catch(e){
      document.getElementById('delCatError').textContent = e.message;
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete category';
    }
  });
}

async function renderAnalyticsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading analytics…</p></div>`;
  let data;
  let dailyData;
  try{
    const [analyticsRes, dailyRes] = await Promise.all([
      Api.adminAnalytics(),
      Api.adminDailyStats(30)
    ]);
    data = analyticsRes;
    dailyData = dailyRes.daily || [];
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load analytics</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }
  const { totals, byExhibit, recent } = data;
  contentEl.innerHTML = `
    <div class="stat-cards">
      <div class="stat-card"><div class="num">${totals.allTime}</div><div class="label">All-time views</div></div>
      <div class="stat-card"><div class="num">${totals.last7Days}</div><div class="label">Last 7 days</div></div>
      <div class="stat-card"><div class="num">${totals.last24Hours}</div><div class="label">Last 24 hours</div></div>
    </div>

    <div class="analytics-chart-section" style="margin:24px 26px 16px;">
      <h3 style="font-family:'Fraunces',serif; font-size:16px; margin:0 0 12px;">Views Over Time (Last 30 Days)</h3>
      <div style="position:relative; height:300px; background:var(--white); border:1px solid var(--grey-100); border-radius:12px; padding:16px;">
        <canvas id="analyticsChart"></canvas>
      </div>
      <div style="display:flex; gap:16px; margin-top:12px; flex-wrap:wrap; font-size:13px; color:var(--ink-soft);">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="chartShowScans" checked> Scans (QR)
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="chartShowViews" checked> Direct Views
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="chartShowTotal" checked> Total
        </label>
      </div>
    </div>

    <div style="padding:0 26px 8px;"><h3 style="font-family:'Fraunces',serif; font-size:16px; margin:0 0 10px;">Most viewed exhibits</h3></div>
    <div class="admin-table-wrap">
      <table class="ledger">
        <thead><tr><th>Exhibit</th><th>Code</th><th>Scans (QR)</th><th>Other views</th><th>Total</th></tr></thead>
        <tbody>
          ${byExhibit.length ? byExhibit.map(row => `
            <tr>
              <td class="title-cell" data-label="Exhibit">${escapeHtml(row.title)}</td>
              <td class="id-cell" data-label="Code">${row.code || '—'}</td>
              <td data-label="Scans (QR)">${row.scans}</td>
              <td data-label="Other views">${row.views}</td>
              <td data-label="Total"><b>${row.total}</b></td>
            </tr>
          `).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--ink-soft); padding:24px;">No views recorded yet.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div style="padding:20px 26px 8px;"><h3 style="font-family:'Fraunces',serif; font-size:16px; margin:0 0 10px;">Recent activity</h3></div>
    <div class="admin-table-wrap" style="padding-bottom:20px;">
      <table class="ledger">
        <thead><tr><th>When</th><th>Exhibit</th><th>Source</th></tr></thead>
        <tbody>
          ${recent.length ? recent.map(ev => `
            <tr>
              <td data-label="When" style="font-size:12px; color:var(--ink-soft);">${new Date(ev.at).toLocaleString()}</td>
              <td class="title-cell" data-label="Exhibit">${escapeHtml(ev.title)}</td>
              <td data-label="Source"><span class="cat-pill">${ev.source === 'scan' ? 'QR scan' : 'Direct view'}</span></td>
            </tr>
          `).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--ink-soft); padding:24px;">Nothing yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  // Render line chart
  if (typeof Chart !== 'undefined' && dailyData.length) {
    renderAnalyticsChart(dailyData);
    document.getElementById('chartShowScans')?.addEventListener('change', ()=>renderAnalyticsChart(dailyData));
    document.getElementById('chartShowViews')?.addEventListener('change', ()=>renderAnalyticsChart(dailyData));
    document.getElementById('chartShowTotal')?.addEventListener('change', ()=>renderAnalyticsChart(dailyData));
  }
}

function renderAnalyticsChart(daily) {
  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;
  const showScans = document.getElementById('chartShowScans')?.checked ?? true;
  const showViews = document.getElementById('chartShowViews')?.checked ?? true;
  const showTotal = document.getElementById('chartShowTotal')?.checked ?? true;

  const labels = daily.map(d => d.label);
  const datasets = [];

  if (showScans) {
    datasets.push({
      label: 'Scans (QR)',
      data: daily.map(d => d.scans),
      borderColor: '#00A4BD',
      backgroundColor: 'rgba(0,164,189,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    });
  }
  if (showViews) {
    datasets.push({
      label: 'Direct Views',
      data: daily.map(d => d.views),
      borderColor: '#E85D2A',
      backgroundColor: 'rgba(232,93,42,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    });
  }
  if (showTotal) {
    datasets.push({
      label: 'Total',
      data: daily.map(d => d.total),
      borderColor: '#2B271F',
      backgroundColor: 'rgba(43,39,31,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderDash: [6, 4]
    });
  }

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy();
  }
  window.analyticsChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, stepSize: 1 } }
      }
    }
  });
}

// ---------------- Feedback ----------------
let adminFeedbackSearch = '';
let adminFeedbackRating = 'all';

async function renderFeedbackTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading feedback…</p></div>`;
  let ratings;
  try{
    const res = await Api.adminRatings();
    ratings = res.ratings || [];
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load feedback</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  let filteredRatings = [...ratings];
  if(adminFeedbackRating !== 'all'){
    if(adminFeedbackRating === 'has-comment'){
      filteredRatings = filteredRatings.filter(r => Boolean(r.comment && r.comment.trim()));
    } else {
      const star = parseInt(adminFeedbackRating, 10);
      if(!isNaN(star)) filteredRatings = filteredRatings.filter(r => r.rating === star);
    }
  }

  if(adminFeedbackSearch){
    const q = adminFeedbackSearch.toLowerCase();
    filteredRatings = filteredRatings.filter(r =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.code || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q)
    );
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminFeedbackSearchInput" class="admin-search-input" placeholder="Search comments, exhibits, codes…" value="${escapeHtml(adminFeedbackSearch)}">
        <span style="font-size:13px; color:var(--ink-soft);">${filteredRatings.length} of ${ratings.length} ratings</span>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;" id="adminFeedbackFilters">
        <button class="filter-chip ${adminFeedbackRating==='all'?'active':''}" data-rating="all">All (${ratings.length})</button>
        <button class="filter-chip ${adminFeedbackRating==='5'?'active':''}" data-rating="5">5 ★ (${ratings.filter(r=>r.rating===5).length})</button>
        <button class="filter-chip ${adminFeedbackRating==='4'?'active':''}" data-rating="4">4 ★ (${ratings.filter(r=>r.rating===4).length})</button>
        <button class="filter-chip ${adminFeedbackRating==='3'?'active':''}" data-rating="3">3 ★ (${ratings.filter(r=>r.rating===3).length})</button>
        <button class="filter-chip ${adminFeedbackRating==='2'?'active':''}" data-rating="2">2 ★ (${ratings.filter(r=>r.rating===2).length})</button>
        <button class="filter-chip ${adminFeedbackRating==='1'?'active':''}" data-rating="1">1 ★ (${ratings.filter(r=>r.rating===1).length})</button>
        <button class="filter-chip ${adminFeedbackRating==='has-comment'?'active':''}" data-rating="has-comment">With comments (${ratings.filter(r=>Boolean(r.comment&&r.comment.trim())).length})</button>
      </div>
    </div>
    <div style="padding:14px 26px 26px; display:flex; flex-direction:column; gap:12px; margin-top:8px;" id="feedbackList"></div>
    ${filteredRatings.length===0 ? `<div class="empty-state"><h2>No matching feedback</h2><p>No feedback ratings found matching your filter criteria.</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminFeedbackSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminFeedbackSearch = e.target.value.trim();
      renderFeedbackTab(contentEl);
      const updated = document.getElementById('adminFeedbackSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  contentEl.querySelectorAll('#adminFeedbackFilters [data-rating]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      adminFeedbackRating = btn.dataset.rating;
      renderFeedbackTab(contentEl);
    });
  });

  const list = document.getElementById('feedbackList');
  list.innerHTML = filteredRatings.map(r => `
    <div class="rating-item">
      <div class="feedback-row">
        <div>
          <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          <span style="font-size:12.5px; color:var(--ink-soft); margin-left:8px;">${escapeHtml(r.title)} · ${r.code||''}</span>
          ${r.comment ? `<div class="comment" style="margin-top:6px;">${escapeHtml(r.comment)}</div>` : `<div class="comment" style="margin-top:6px; color:var(--ink-soft); font-style:italic;">No comment left.</div>`}
          <div class="when">${new Date(r.createdAt).toLocaleString()}</div>
        </div>
        <button class="btn btn-danger btn-small" data-remove-rating="${r.id}">Remove</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-remove-rating]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Remove this rating? This cannot be undone.')) return;
      try{
        await Api.adminDeleteRating(btn.dataset.removeRating);
        renderFeedbackTab(contentEl);
      }catch(e){ toast(e.message, true); }
    });
  });
}

// ── Common CSV Download Helper ────────────────────────────────────
function downloadCSV(csvContent, filename){
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------- Visitor Log (Live) & Visitor History (Past) ----------------
let visitorsCache = [];
let visitorStatsCache = null;

// Live Visitor Log State
let adminLiveVisitorsSearch = '';
let adminLiveVisitorsGroupFilter = 'All';

// Visitor History State
let adminHistoryVisitorsSearch = '';
let adminHistoryVisitorsGroupFilter = 'All';
let adminHistoryVisitorsPreset = 'past5'; // 'past5', 'past7', 'past30', 'all', 'custom'
let adminHistoryVisitorsDate = '';

function getPhilippineTodayIso() {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch (e) {
    return now.toISOString().slice(0, 10);
  }
}

function getPastDateIso(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

// ─── 1. Live Visitor Log (Today's Visitors) ───
async function renderVisitorsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading live visitor logs…</p></div>`;
  try{
    const [visRes, statsRes] = await Promise.all([
      Api.listVisitors(),
      Api.getVisitorStats().catch(()=>({ stats: {} }))
    ]);
    visitorsCache = (visRes && Array.isArray(visRes.visitors)) ? visRes.visitors : [];
    visitorStatsCache = (statsRes && statsRes.stats) ? statsRes.stats : {};
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load live visitor logs</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const todayIso = getPhilippineTodayIso();
  // Filter for today's live visitors
  let liveVisitors = visitorsCache.filter(v => (v.visitDate || '').startsWith(todayIso));

  const todayTotalVisits = liveVisitors.length;
  const todayTotalPax = liveVisitors.reduce((sum, v) => sum + (v.pax || 1), 0);
  const schoolTours = liveVisitors.filter(v => (v.groupType || '').toLowerCase() === 'school tour').length;

  let filtered = [...liveVisitors];
  if(adminLiveVisitorsSearch){
    const q = adminLiveVisitorsSearch.toLowerCase();
    filtered = filtered.filter(v =>
      (v.visitorName || '').toLowerCase().includes(q) ||
      (v.groupName || '').toLowerCase().includes(q) ||
      (v.contactNumber || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.purpose || '').toLowerCase().includes(q) ||
      (v.tourGuide || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q) ||
      (v.address || '').toLowerCase().includes(q)
    );
  }
  if(adminLiveVisitorsGroupFilter !== 'All'){
    filtered = filtered.filter(v => (v.groupType || '').toLowerCase() === adminLiveVisitorsGroupFilter.toLowerCase());
  }

  contentEl.innerHTML = `
    <!-- Live KPIs -->
    <div class="kpi-cards-grid">
      <div class="kpi-stat-card" style="border:1.5px solid rgba(94,234,212,0.4); background:linear-gradient(135deg, rgba(0,42,54,0.9) 0%, rgba(0,174,189,0.2) 100%);">
        <div class="kpi-stat-icon green">🟢</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value" style="color:#5eead4;">${todayTotalPax} <span style="font-size:12px; font-weight:600; color:#cbd5e1;">pax</span></div>
          <div class="kpi-stat-label">Today's Headcount (${todayTotalVisits} logs)</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon orange">👥</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${todayTotalVisits}</div>
          <div class="kpi-stat-label">Today's Visits Logged</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon purple">🏫</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${schoolTours}</div>
          <div class="kpi-stat-label">School / Group Tours</div>
        </div>
      </div>
      <div class="kpi-stat-card" style="cursor:pointer;" data-tab="visitorHistory" title="View historical records">
        <div class="kpi-stat-icon">📜</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${visitorsCache.length}</div>
          <div class="kpi-stat-label">All-Time History Archive →</div>
        </div>
      </div>
    </div>

    <!-- Live Toolbar -->
    <div class="admin-toolbar-wrap" style="margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; padding:8px 12px; background:rgba(0,42,54,0.6); border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span>
          <span style="font-size:13px; font-weight:800; color:#ffffff;">LIVE VISITOR LOG · ${todayIso}</span>
        </div>
        <a href="#" class="view-all-btn" data-tab="visitorHistory" style="font-size:12px; color:#5eead4; font-weight:700;">📜 View Past 5+ Days in Visitor History →</a>
      </div>

      <div class="admin-toolbar-row">
        <input type="text" id="adminLiveVisitorsSearchInput" class="admin-search-input" placeholder="Search today's visitors by name, group, school, phone, address…" value="${escapeHtml(adminLiveVisitorsSearch)}">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-primary btn-small" id="addWalkinVisitorBtn">+ Log walk-in</button>
          <button class="btn btn-primary btn-small" id="visitorCheckinQrBtn">📱 Check-in QR</button>
          <button class="btn-export" id="exportLiveVisitorsBtn" title="Export today's list as CSV">📥 Export Today CSV</button>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="adminLiveVisitorsGroupSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminLiveVisitorsGroupFilter==='All'?'selected':''}>All Group Types</option>
            <option value="Walk-in / Individual" ${adminLiveVisitorsGroupFilter==='Walk-in / Individual'?'selected':''}>Walk-in / Individual</option>
            <option value="School Tour" ${adminLiveVisitorsGroupFilter==='School Tour'?'selected':''}>School Tour</option>
            <option value="Family" ${adminLiveVisitorsGroupFilter==='Family'?'selected':''}>Family</option>
            <option value="Government / VIP" ${adminLiveVisitorsGroupFilter==='Government / VIP'?'selected':''}>Government / VIP</option>
            <option value="NGO / Community" ${adminLiveVisitorsGroupFilter==='NGO / Community'?'selected':''}>NGO / Community</option>
            <option value="Researcher / Scholar" ${adminLiveVisitorsGroupFilter==='Researcher / Scholar'?'selected':''}>Researcher / Scholar</option>
            <option value="Other" ${adminLiveVisitorsGroupFilter==='Other'?'selected':''}>Other</option>
          </select>
          ${(adminLiveVisitorsSearch || adminLiveVisitorsGroupFilter !== 'All') ? '<button type="button" class="btn btn-ghost dark btn-small" id="clearLiveVisitorsFilters" style="padding:4px 8px; font-size:11.5px; color:#5eead4; border-color:rgba(0,174,189,0.4);">Reset filters</button>' : ''}
        </div>
        <span style="font-size:13px; color:#cbd5e1; font-weight:600;">${filtered.length} of ${liveVisitors.length} today</span>
      </div>
    </div>

    <!-- Live Visitors Table -->
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead>
          <tr>
            <th>Time</th>
            <th>Visitor / Contact</th>
            <th>Group / Organization</th>
            <th style="text-align:center;">Pax</th>
            <th>Purpose</th>
            <th>Tour Guide</th>
            <th>Address</th>
            <th>Sex</th>
            <th>Age</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="liveVisitorsTableBody"></tbody>
      </table>
    </div>
    ${filtered.length === 0 ? `
      <div class="empty-state">
        <h2 style="color:#ffffff;">No live visitors today yet</h2>
        <p style="color:#cbd5e1;">Visitors who check in today (${todayIso}) will appear here in real time.</p>
        <div style="margin-top:14px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-primary btn-small" id="addWalkinVisitorBtnEmpty">+ Log walk-in</button>
          <a href="#" class="btn btn-ghost dark btn-small" data-tab="visitorHistory">Open Visitor History Archive →</a>
        </div>
      </div>
    ` : ''}
  `;

  // Bind Events
  const searchInput = document.getElementById('adminLiveVisitorsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminLiveVisitorsSearch = e.target.value.trim();
      renderVisitorsTab(contentEl);
      const updated = document.getElementById('adminLiveVisitorsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  document.getElementById('adminLiveVisitorsGroupSelect')?.addEventListener('change', (e)=>{
    adminLiveVisitorsGroupFilter = e.target.value;
    renderVisitorsTab(contentEl);
  });
  document.getElementById('clearLiveVisitorsFilters')?.addEventListener('click', ()=>{
    adminLiveVisitorsSearch = '';
    adminLiveVisitorsGroupFilter = 'All';
    renderVisitorsTab(contentEl);
  });
  document.getElementById('exportLiveVisitorsBtn')?.addEventListener('click', ()=>exportVisitorsCSV(filtered, `msbn-live-visitors-${todayIso}.csv`));
  document.getElementById('addWalkinVisitorBtn')?.addEventListener('click', ()=>openVisitorWalkinModal());
  document.getElementById('addWalkinVisitorBtnEmpty')?.addEventListener('click', ()=>openVisitorWalkinModal());
  document.getElementById('visitorCheckinQrBtn')?.addEventListener('click', ()=>openVisitorCheckinQrModal());

  const tbody = document.getElementById('liveVisitorsTableBody');
  if(tbody){
    tbody.innerHTML = filtered.map(v => {
      const contactInfo = [v.contactNumber, v.email].filter(Boolean).join(' · ');
      return `
        <tr>
          <td data-label="Time" style="white-space:nowrap;">
            <div style="font-weight:800; color:#ffffff; font-size:14px;">${escapeHtml(v.visitTime || '—')}</div>
          </td>
          <td data-label="Visitor / Contact">
            <div style="font-weight:800; color:#ffffff; font-size:14.5px;">${escapeHtml(v.visitorName)}</div>
            ${contactInfo ? `<div style="font-size:11.5px; color:#cbd5e1; margin-top:2px;">${escapeHtml(contactInfo)}</div>` : ''}
          </td>
          <td data-label="Group / Organization">
            ${v.groupName ? `<div style="font-weight:700; color:#ffffff; font-size:14px; margin-bottom:4px;">${escapeHtml(v.groupName)}</div>` : ''}
            <span class="cat-pill" style="font-size:10px; font-weight:700; background:rgba(0,174,189,0.20); color:#5eead4; border:1px solid rgba(0,174,189,0.35);">${escapeHtml(v.groupType || 'Individual')}</span>
          </td>
          <td data-label="Pax" style="text-align:center;">
            <span style="font-weight:800; font-size:14px; background:rgba(0,174,189,0.25); color:#5eead4; border:1px solid rgba(0,174,189,0.45); padding:3px 9px; border-radius:8px; display:inline-block;">${v.pax || 1}</span>
          </td>
          <td data-label="Purpose">
            <div style="font-size:13.5px; font-weight:600; color:#ffffff;">${escapeHtml(v.purpose || 'General Visit')}</div>
            ${v.notes ? `<div style="font-size:11.5px; color:#cbd5e1; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="${escapeHtml(v.notes)}">📝 ${escapeHtml(v.notes)}</div>` : ''}
          </td>
          <td data-label="Tour Guide">
            <div style="font-size:13px; font-weight:600; color:${v.tourGuide ? '#ffffff' : '#94a3b8'};">${escapeHtml(v.tourGuide || 'Unassigned')}</div>
          </td>
          <td data-label="Address" style="font-size:12.5px; color:#f1f5f9; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(v.address || '—')}">${escapeHtml(v.address || '—')}</td>
          <td data-label="Sex" style="font-size:12.5px; color:#f1f5f9;">${escapeHtml(v.sex || '—')}</td>
          <td data-label="Age" style="font-size:12.5px; color:#f1f5f9; text-align:center; font-weight:700;">${v.age !== null && v.age !== undefined ? v.age : '—'}</td>
          <td data-label="Actions" style="text-align:right; white-space:nowrap;">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-ghost dark btn-small" data-view-visitor="${v.id}" title="View details (read-only)">View</button>
              <button class="btn btn-danger btn-small" data-del-visitor="${v.id}" title="Delete entry">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-view-visitor]').forEach(btn => {
      btn.addEventListener('click', () => openVisitorDetailsModal(btn.dataset.viewVisitor));
    });

    tbody.querySelectorAll('[data-del-visitor]').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const v = visitorsCache.find(item => item.id === btn.dataset.delVisitor);
        if(!v) return;
        if(!confirm(`Delete visitor log entry for "${v.visitorName}" (${v.visitDate})?`)) return;
        try{
          await Api.deleteVisitor(v.id);
          toast('Visitor log deleted');
          renderVisitorsTab(contentEl);
        }catch(err){ toast(err.message, true); }
      });
    });
  }
}

// ─── 2. Visitor History (Past 5 Days & Complete Historical Archive) ───
async function renderVisitorHistoryTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading visitor history archive…</p></div>`;
  try{
    const [visRes, statsRes] = await Promise.all([
      Api.listVisitors(),
      Api.getVisitorStats().catch(()=>({ stats: {} }))
    ]);
    visitorsCache = (visRes && Array.isArray(visRes.visitors)) ? visRes.visitors : [];
    visitorStatsCache = (statsRes && statsRes.stats) ? statsRes.stats : {};
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load visitor history</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const todayIso = getPhilippineTodayIso();
  const past5Cutoff = getPastDateIso(5);
  const past7Cutoff = getPastDateIso(7);
  const past30Cutoff = getPastDateIso(30);

  // Filter based on preset
  let historyList = visitorsCache.filter(v => (v.visitDate || '') < todayIso);

  if(adminHistoryVisitorsPreset === 'past5'){
    historyList = historyList.filter(v => (v.visitDate || '') >= past5Cutoff);
  } else if(adminHistoryVisitorsPreset === 'past7'){
    historyList = historyList.filter(v => (v.visitDate || '') >= past7Cutoff);
  } else if(adminHistoryVisitorsPreset === 'past30'){
    historyList = historyList.filter(v => (v.visitDate || '') >= past30Cutoff);
  } else if(adminHistoryVisitorsPreset === 'custom' && adminHistoryVisitorsDate){
    historyList = visitorsCache.filter(v => (v.visitDate || '').startsWith(adminHistoryVisitorsDate));
  } else if(adminHistoryVisitorsPreset === 'all'){
    historyList = [...visitorsCache];
  }

  const totalHistVisits = historyList.length;
  const totalHistPax = historyList.reduce((sum, v) => sum + (v.pax || 1), 0);
  const schoolTours = historyList.filter(v => (v.groupType || '').toLowerCase() === 'school tour').length;

  let filtered = [...historyList];
  if(adminHistoryVisitorsSearch){
    const q = adminHistoryVisitorsSearch.toLowerCase();
    filtered = filtered.filter(v =>
      (v.visitorName || '').toLowerCase().includes(q) ||
      (v.groupName || '').toLowerCase().includes(q) ||
      (v.contactNumber || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.purpose || '').toLowerCase().includes(q) ||
      (v.tourGuide || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q) ||
      (v.address || '').toLowerCase().includes(q)
    );
  }
  if(adminHistoryVisitorsGroupFilter !== 'All'){
    filtered = filtered.filter(v => (v.groupType || '').toLowerCase() === adminHistoryVisitorsGroupFilter.toLowerCase());
  }

  contentEl.innerHTML = `
    <!-- History KPIs -->
    <div class="kpi-cards-grid">
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon">📋</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${totalHistVisits}</div>
          <div class="kpi-stat-label">Past Visits (${adminHistoryVisitorsPreset.toUpperCase()})</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon orange">👥</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${totalHistPax}</div>
          <div class="kpi-stat-label">Total Past Visitors (Pax)</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon green">🏫</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${schoolTours}</div>
          <div class="kpi-stat-label">School & Group Tours</div>
        </div>
      </div>
      <div class="kpi-stat-card" style="cursor:pointer;" data-tab="visitors" title="Go to Live Visitor Log">
        <div class="kpi-stat-icon">🟢</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">Live Log</div>
          <div class="kpi-stat-label">Go to Today's Visitors →</div>
        </div>
      </div>
    </div>

    <!-- History Toolbar -->
    <div class="admin-toolbar-wrap" style="margin-top:12px;">
      <!-- History Range Presets -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="filter-chip ${adminHistoryVisitorsPreset==='past5'?'active':''}" id="vHistPast5">Past 5 Days</button>
          <button class="filter-chip ${adminHistoryVisitorsPreset==='past7'?'active':''}" id="vHistPast7">Past 7 Days</button>
          <button class="filter-chip ${adminHistoryVisitorsPreset==='past30'?'active':''}" id="vHistPast30">Past 30 Days</button>
          <button class="filter-chip ${adminHistoryVisitorsPreset==='all'?'active':''}" id="vHistAllTime">All History (${visitorsCache.length})</button>
        </div>
        <a href="#" class="view-all-btn" data-tab="visitors" style="font-size:12px; color:#5eead4; font-weight:700;">🟢 Live Visitors Today →</a>
      </div>

      <div class="admin-toolbar-row">
        <input type="text" id="adminHistoryVisitorsSearchInput" class="admin-search-input" placeholder="Search past visitor history by name, school, group, guide, address…" value="${escapeHtml(adminHistoryVisitorsSearch)}">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button class="btn-export" id="exportHistoryVisitorsBtn" title="Export current history list as CSV">📥 Export CSV</button>
          <button class="btn btn-ghost dark btn-small" id="printHistoryReportBtn" title="Print visitor history report">🖨 Print Report</button>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="adminHistoryVisitorsGroupSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminHistoryVisitorsGroupFilter==='All'?'selected':''}>All Group Types</option>
            <option value="Walk-in / Individual" ${adminHistoryVisitorsGroupFilter==='Walk-in / Individual'?'selected':''}>Walk-in / Individual</option>
            <option value="School Tour" ${adminHistoryVisitorsGroupFilter==='School Tour'?'selected':''}>School Tour</option>
            <option value="Family" ${adminHistoryVisitorsGroupFilter==='Family'?'selected':''}>Family</option>
            <option value="Government / VIP" ${adminHistoryVisitorsGroupFilter==='Government / VIP'?'selected':''}>Government / VIP</option>
            <option value="NGO / Community" ${adminHistoryVisitorsGroupFilter==='NGO / Community'?'selected':''}>NGO / Community</option>
            <option value="Researcher / Scholar" ${adminHistoryVisitorsGroupFilter==='Researcher / Scholar'?'selected':''}>Researcher / Scholar</option>
            <option value="Other" ${adminHistoryVisitorsGroupFilter==='Other'?'selected':''}>Other</option>
          </select>
          <input type="date" id="adminHistoryVisitorsDateInput" value="${escapeHtml(adminHistoryVisitorsDate)}" title="Filter by specific visit date" style="padding:5px 10px; font-size:12.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,42,54,0.85); color:#ffffff;">
          ${(adminHistoryVisitorsSearch || adminHistoryVisitorsGroupFilter !== 'All' || adminHistoryVisitorsDate || adminHistoryVisitorsPreset !== 'past5') ? '<button type="button" class="btn btn-ghost dark btn-small" id="clearHistoryFilters" style="padding:4px 8px; font-size:11.5px; color:#5eead4; border-color:rgba(0,174,189,0.4);">Reset filters</button>' : ''}
        </div>
        <span style="font-size:13px; color:#cbd5e1; font-weight:600;">${filtered.length} of ${historyList.length} historical records</span>
      </div>
    </div>

    <!-- History Table -->
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Visitor / Contact</th>
            <th>Group / Organization</th>
            <th style="text-align:center;">Pax</th>
            <th>Purpose</th>
            <th>Tour Guide</th>
            <th>Address</th>
            <th>Sex</th>
            <th>Age</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="historyVisitorsTableBody"></tbody>
      </table>
    </div>
    ${filtered.length === 0 ? `<div class="empty-state"><h2 style="color:#ffffff;">No past visitor records found</h2><p style="color:#cbd5e1;">No historical visitor records match the selected range and filters.</p></div>` : ''}
  `;

  // Bind History Events
  document.getElementById('vHistPast5')?.addEventListener('click', ()=>{
    adminHistoryVisitorsPreset = 'past5';
    adminHistoryVisitorsDate = '';
    renderVisitorHistoryTab(contentEl);
  });
  document.getElementById('vHistPast7')?.addEventListener('click', ()=>{
    adminHistoryVisitorsPreset = 'past7';
    adminHistoryVisitorsDate = '';
    renderVisitorHistoryTab(contentEl);
  });
  document.getElementById('vHistPast30')?.addEventListener('click', ()=>{
    adminHistoryVisitorsPreset = 'past30';
    adminHistoryVisitorsDate = '';
    renderVisitorHistoryTab(contentEl);
  });
  document.getElementById('vHistAllTime')?.addEventListener('click', ()=>{
    adminHistoryVisitorsPreset = 'all';
    adminHistoryVisitorsDate = '';
    renderVisitorHistoryTab(contentEl);
  });

  const searchInput = document.getElementById('adminHistoryVisitorsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminHistoryVisitorsSearch = e.target.value.trim();
      renderVisitorHistoryTab(contentEl);
      const updated = document.getElementById('adminHistoryVisitorsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  document.getElementById('adminHistoryVisitorsGroupSelect')?.addEventListener('change', (e)=>{
    adminHistoryVisitorsGroupFilter = e.target.value;
    renderVisitorHistoryTab(contentEl);
  });
  document.getElementById('adminHistoryVisitorsDateInput')?.addEventListener('change', (e)=>{
    adminHistoryVisitorsDate = e.target.value;
    adminHistoryVisitorsPreset = 'custom';
    renderVisitorHistoryTab(contentEl);
  });
  document.getElementById('clearHistoryFilters')?.addEventListener('click', ()=>{
    adminHistoryVisitorsSearch = '';
    adminHistoryVisitorsGroupFilter = 'All';
    adminHistoryVisitorsPreset = 'past5';
    adminHistoryVisitorsDate = '';
    renderVisitorHistoryTab(contentEl);
  });

  document.getElementById('exportHistoryVisitorsBtn')?.addEventListener('click', ()=>exportVisitorsCSV(filtered, `msbn-visitor-history-${adminHistoryVisitorsPreset}.csv`));
  document.getElementById('printHistoryReportBtn')?.addEventListener('click', ()=>printVisitorsHistoryReport(filtered));

  const tbody = document.getElementById('historyVisitorsTableBody');
  if(tbody){
    tbody.innerHTML = filtered.map(v => {
      const contactInfo = [v.contactNumber, v.email].filter(Boolean).join(' · ');
      return `
        <tr>
          <td data-label="Date & Time" style="white-space:nowrap;">
            <div style="font-weight:800; color:#ffffff; font-size:13.5px;">${escapeHtml(v.visitDate || '—')}</div>
            <div style="font-size:11.5px; color:#cbd5e1; font-weight:600;">${escapeHtml(v.visitTime || '')}</div>
          </td>
          <td data-label="Visitor / Contact">
            <div style="font-weight:800; color:#ffffff; font-size:14.5px;">${escapeHtml(v.visitorName)}</div>
            ${contactInfo ? `<div style="font-size:11.5px; color:#cbd5e1; margin-top:2px;">${escapeHtml(contactInfo)}</div>` : ''}
          </td>
          <td data-label="Group / Organization">
            ${v.groupName ? `<div style="font-weight:700; color:#ffffff; font-size:14px; margin-bottom:4px;">${escapeHtml(v.groupName)}</div>` : ''}
            <span class="cat-pill" style="font-size:10px; font-weight:700; background:rgba(0,174,189,0.20); color:#5eead4; border:1px solid rgba(0,174,189,0.35);">${escapeHtml(v.groupType || 'Individual')}</span>
          </td>
          <td data-label="Pax" style="text-align:center;">
            <span style="font-weight:800; font-size:14px; background:rgba(0,174,189,0.25); color:#5eead4; border:1px solid rgba(0,174,189,0.45); padding:3px 9px; border-radius:8px; display:inline-block;">${v.pax || 1}</span>
          </td>
          <td data-label="Purpose">
            <div style="font-size:13.5px; font-weight:600; color:#ffffff;">${escapeHtml(v.purpose || 'General Visit')}</div>
            ${v.notes ? `<div style="font-size:11.5px; color:#cbd5e1; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="${escapeHtml(v.notes)}">📝 ${escapeHtml(v.notes)}</div>` : ''}
          </td>
          <td data-label="Tour Guide">
            <div style="font-size:13px; font-weight:600; color:${v.tourGuide ? '#ffffff' : '#94a3b8'};">${escapeHtml(v.tourGuide || 'Unassigned')}</div>
          </td>
          <td data-label="Address" style="font-size:12.5px; color:#f1f5f9; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(v.address || '—')}">${escapeHtml(v.address || '—')}</td>
          <td data-label="Sex" style="font-size:12.5px; color:#f1f5f9;">${escapeHtml(v.sex || '—')}</td>
          <td data-label="Age" style="font-size:12.5px; color:#f1f5f9; text-align:center; font-weight:700;">${v.age !== null && v.age !== undefined ? v.age : '—'}</td>
          <td data-label="Actions" style="text-align:right; white-space:nowrap;">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="btn btn-ghost dark btn-small" data-view-visitor="${v.id}" title="View full history record (read-only)">View</button>
              <button class="btn btn-danger btn-small" data-del-visitor="${v.id}" title="Delete entry">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-view-visitor]').forEach(btn => {
      btn.addEventListener('click', () => openVisitorDetailsModal(btn.dataset.viewVisitor));
    });

    tbody.querySelectorAll('[data-del-visitor]').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const v = visitorsCache.find(item => item.id === btn.dataset.delVisitor);
        if(!v) return;
        if(!confirm(`Delete visitor history entry for "${v.visitorName}" (${v.visitDate})?`)) return;
        try{
          await Api.deleteVisitor(v.id);
          toast('Visitor history record deleted');
          renderVisitorHistoryTab(contentEl);
        }catch(err){ toast(err.message, true); }
      });
    });
  }
}

// ─── 3. Read-Only Visitor Details Modal (Immutable Details) ───
function openVisitorDetailsModal(id){
  const v = visitorsCache.find(x => x.id === id);
  if(!v) return;

  const contactInfo = [v.contactNumber, v.email].filter(Boolean).join(' · ');

  openModal(`
    <div style="max-width: 580px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
        <div>
          <span class="cat-pill" style="font-size: 11px; margin-bottom: 6px; display: inline-block;">${escapeHtml(v.groupType || 'Individual')}</span>
          <h2 style="margin: 0; font-size: 22px; color: #fff;">${escapeHtml(v.visitorName)}</h2>
          ${v.groupName ? `<div style="font-size: 14px; color: #5eead4; font-weight: 700; margin-top: 2px;">🏛️ ${escapeHtml(v.groupName)}</div>` : ''}
        </div>
      </div>

      <!-- Immutable Notice Banner -->
      <div style="background: rgba(0, 174, 189, 0.15); border: 1px solid rgba(0, 174, 189, 0.35); border-radius: 8px; padding: 7px 12px; margin-bottom: 14px; font-size: 11.5px; color: #5eead4; display: flex; align-items: center; gap: 8px;">
        <span>🔒</span>
        <span>Visitor check-in details are verified and read-only to preserve record integrity.</span>
      </div>

      <!-- Detail Grid Card -->
      <div style="background: rgba(0, 42, 54, 0.85); border: 1.5px solid rgba(255, 255, 255, 0.16); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Visit Date & Time</div>
            <div style="font-size: 14px; color: #fff; font-weight: 700; margin-top: 2px;">📅 ${escapeHtml(v.visitDate || '—')} at ${escapeHtml(v.visitTime || '')}</div>
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Party Size (Pax)</div>
            <div style="font-size: 14px; color: #5eead4; font-weight: 800; margin-top: 2px;">👥 ${v.pax || 1} Person(s)</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Contact Information</div>
            <div style="font-size: 13.5px; color: #fff; margin-top: 2px;">${escapeHtml(contactInfo || 'None provided')}</div>
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Demographics</div>
            <div style="font-size: 13.5px; color: #fff; margin-top: 2px;">${escapeHtml(v.sex || '—')} · Age: ${v.age != null ? v.age : '—'}</div>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Address / Origin</div>
          <div style="font-size: 13.5px; color: #fff; margin-top: 2px;">📍 ${escapeHtml(v.address || 'Not specified')}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Purpose of Visit</div>
            <div style="font-size: 13.5px; color: #fff; margin-top: 2px;">${escapeHtml(v.purpose || 'General Visit')}</div>
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Assigned Tour Guide</div>
            <div style="font-size: 13.5px; color: #fff; margin-top: 2px;">🧑‍💼 ${escapeHtml(v.tourGuide || 'Unassigned')}</div>
          </div>
        </div>

        ${v.notes ? `
          <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Notes & Remarks</div>
            <div style="font-size: 13px; color: #cbd5e1; margin-top: 2px; line-height: 1.5; font-style: italic;">📝 ${escapeHtml(v.notes)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Quick Actions -->
      <div style="display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 10px;">
        <button type="button" class="btn btn-ghost dark btn-small" id="printSingleVisitorPassBtn">🖨 Print Pass</button>
        <button type="button" class="btn btn-primary btn-small" id="closeVisitorDetailBtn">Close</button>
      </div>
    </div>
  `);

  document.getElementById('closeVisitorDetailBtn')?.addEventListener('click', closeModal);

  document.getElementById('printSingleVisitorPassBtn')?.addEventListener('click', () => {
    const win = window.open('', '_blank', 'width=600,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Visitor Pass — ${escapeHtml(v.visitorName)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet">
        <style>
          body { margin: 40px; font-family: 'Nunito', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
          .pass-box { border: 2.5px solid #007d8a; border-radius: 16px; padding: 24px; text-align: center; max-width: 340px; width: 100%; box-sizing: border-box; }
          .mono { font-family: 'IBM Plex Mono', monospace; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="pass-box">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #007d8a; margin-bottom: 4px;">Museo Sang Bata sa Negros</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 10px;">OFFICIAL VISITOR PASS</div>
          <div style="font-size: 20px; font-weight: 900; color: #007d8a; margin-bottom: 4px;">${escapeHtml(v.visitorName)}</div>
          ${v.groupName ? `<div style="font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 12px;">${escapeHtml(v.groupName)}</div>` : ''}
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 12px 0; text-align: left; font-size: 12px;">
            <div>📅 <strong>Date:</strong> ${escapeHtml(v.visitDate || '—')} ${escapeHtml(v.visitTime || '')}</div>
            <div>👥 <strong>Pax:</strong> ${v.pax || 1}</div>
            <div>📍 <strong>Origin:</strong> ${escapeHtml(v.address || '—')}</div>
          </div>
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Valid for admission</div>
        </div>
        <script>
          window.onload = () => { setTimeout(() => { window.print(); }, 300); };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  });
}

// ─── 4. Walk-in Front Desk Registration Modal (New Walk-in Only) ───
function openVisitorWalkinModal(){
  const now = new Date();
  const defaultDate = getPhilippineTodayIso();
  const defaultTime = now.toTimeString().slice(0, 5);

  openModal(`
    <h2>Log new walk-in visitor</h2>
    <p style="font-size:12.5px; color:var(--ink-soft); margin:-8px 0 16px;">
      Register a front-desk visitor or walk-in group directly into today's log.
    </p>
    <div class="form-grid">
      <div class="form-field full">
        <label>Visitor / Contact Person Name *</label>
        <input type="text" id="vf-name" placeholder="e.g. Maria Santos" required>
      </div>
      <div class="form-field full">
        <label>Address / Hometown *</label>
        <textarea id="vf-address" placeholder="e.g. Brgy. Old Sagay, Sagay City" rows="2" required></textarea>
      </div>
      <div class="form-field">
        <label>Sex *</label>
        <select id="vf-sex">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
      </div>
      <div class="form-field">
        <label>Age *</label>
        <input type="number" id="vf-age" min="0" max="120" placeholder="e.g. 25" required>
      </div>
      <div class="form-field">
        <label>Group / School / Org Name (optional)</label>
        <input type="text" id="vf-group" placeholder="e.g. Sagay National High School">
      </div>
      <div class="form-field">
        <label>Group Type</label>
        <select id="vf-groupType">
          <option value="Walk-in / Individual" selected>Walk-in / Individual</option>
          <option value="School Tour">School Tour</option>
          <option value="Family">Family</option>
          <option value="Government / VIP">Government / VIP</option>
          <option value="NGO / Community">NGO / Community</option>
          <option value="Researcher / Scholar">Researcher / Scholar</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-field">
        <label>Headcount (Pax) *</label>
        <input type="number" id="vf-pax" min="1" value="1">
      </div>
      <div class="form-field">
        <label>Purpose of Visit</label>
        <select id="vf-purpose">
          <option value="General Visit" selected>General Visit</option>
          <option value="Educational Tour">Educational Tour</option>
          <option value="Research">Research</option>
          <option value="Special Event">Special Event</option>
          <option value="Donation / Official">Donation / Official</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-field">
        <label>Visit Date</label>
        <input type="date" id="vf-date" value="${defaultDate}">
      </div>
      <div class="form-field">
        <label>Visit Time</label>
        <input type="time" id="vf-time" value="${defaultTime}">
      </div>
      <div class="form-field">
        <label>Assigned Tour Guide / Staff</label>
        <input type="text" id="vf-guide" placeholder="e.g. Staff Guide">
      </div>
      <div class="form-field">
        <label>Contact Phone / Mobile</label>
        <input type="text" id="vf-phone" placeholder="e.g. +63 917 123 4567">
      </div>
      <div class="form-field">
        <label>Email Address</label>
        <input type="email" placeholder="e.g. visitor@example.com" id="vf-email">
      </div>
      <div class="form-field full">
        <label>Notes / Special Requirements</label>
        <textarea id="vf-notes" rows="2" placeholder="Special accommodations or remarks..."></textarea>
      </div>
      <div class="form-error" id="vfError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="vfCancel">Cancel</button>
      <button class="btn btn-primary" id="vfSave">Log walk-in visitor</button>
    </div>
  `);

  document.getElementById('vfCancel').addEventListener('click', closeModal);
  const saveBtn = document.getElementById('vfSave');
  saveBtn.addEventListener('click', async ()=>{
    const visitorName = document.getElementById('vf-name').value.trim();
    const errorEl = document.getElementById('vfError');
    if(!visitorName){
      errorEl.textContent = 'Visitor or contact person name is required.';
      return;
    }
    const address = document.getElementById('vf-address').value.trim();
    if(!address){
      errorEl.textContent = 'Address is required.';
      return;
    }
    const sex = document.getElementById('vf-sex').value;
    if(!sex){
      errorEl.textContent = 'Sex is required.';
      return;
    }
    const age = document.getElementById('vf-age').value;
    if(age === ''){
      errorEl.textContent = 'Age is required.';
      return;
    }
    const ageNum = parseInt(age, 10);
    if(isNaN(ageNum) || ageNum < 0 || ageNum > 120){
      errorEl.textContent = 'Age must be a valid number between 0 and 120.';
      return;
    }
    const pax = parseInt(document.getElementById('vf-pax').value, 10) || 1;
    if(pax < 1){
      errorEl.textContent = 'Pax must be at least 1.';
      return;
    }

    const payload = {
      visitorName,
      address,
      sex,
      age: ageNum,
      groupName: document.getElementById('vf-group').value.trim(),
      groupType: document.getElementById('vf-groupType').value,
      pax,
      purpose: document.getElementById('vf-purpose').value,
      visitDate: document.getElementById('vf-date').value,
      visitTime: document.getElementById('vf-time').value,
      tourGuide: document.getElementById('vf-guide').value.trim(),
      status: 'Logged',
      contactNumber: document.getElementById('vf-phone').value.trim(),
      email: document.getElementById('vf-email').value.trim(),
      notes: document.getElementById('vf-notes').value.trim()
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Logging visitor…';
    try{
      await Api.createVisitor(payload);
      toast('Walk-in visitor logged successfully');
      closeModal();
      renderDashboard();
    }catch(err){
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Log walk-in visitor';
    }
  });
}

function exportVisitorsCSV(list, filename){
  const headers = ['Date', 'Time', 'Visitor / Contact Person', 'Group / Organization', 'Group Type', 'Pax', 'Purpose', 'Tour Guide', 'Phone', 'Email', 'Address', 'Sex', 'Age', 'Notes'];
  const rows = list.map(v => [
    `"${(v.visitDate || '').replace(/"/g, '""')}"`,
    `"${(v.visitTime || '').replace(/"/g, '""')}"`,
    `"${(v.visitorName || '').replace(/"/g, '""')}"`,
    `"${(v.groupName || '').replace(/"/g, '""')}"`,
    `"${(v.groupType || '').replace(/"/g, '""')}"`,
    v.pax || 1,
    `"${(v.purpose || '').replace(/"/g, '""')}"`,
    `"${(v.tourGuide || '').replace(/"/g, '""')}"`,
    `"${(v.contactNumber || '').replace(/"/g, '""')}"`,
    `"${(v.email || '').replace(/"/g, '""')}"`,
    `"${(v.address || '').replace(/"/g, '""')}"`,
    `"${(v.sex || '').replace(/"/g, '""')}"`,
    v.age !== null && v.age !== undefined ? v.age : '',
    `"${(v.notes || '').replace(/"/g, '""')}"`
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csv, filename || `msbn-visitors-log-${new Date().toISOString().slice(0, 10)}.csv`);
  toast('Visitor CSV exported');
}

function printVisitorsHistoryReport(list) {
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) { toast('Popup blocked. Please allow popups to print.', true); return; }
  
  const totalPax = list.reduce((sum, v) => sum + (v.pax || 1), 0);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Museo Sang Bata sa Negros — Visitor History Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet">
      <style>
        body { margin: 30px; font-family: 'Nunito', sans-serif; color: #1e293b; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #007d8a; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 20px; font-weight: 900; margin: 0; color: #007d8a; }
        .header p { margin: 3px 0 0; color: #64748b; font-size: 12px; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .meta-item { font-size: 11px; }
        .meta-val { font-size: 15px; font-weight: 800; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
        th { background: #007d8a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        @media print { body { margin: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Museo Sang Bata sa Negros</h1>
          <p>Official Visitor History & Log Report</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Generated: <strong>${dateStr}</strong></div>
          <div>Filter: <strong>${escapeHtml(adminHistoryVisitorsPreset.toUpperCase())}</strong></div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item"><div>Total Entries</div><div class="meta-val">${list.length}</div></div>
        <div class="meta-item"><div>Total Visitors (Pax)</div><div class="meta-val">${totalPax}</div></div>
        <div class="meta-item"><div>Group Type Filter</div><div class="meta-val">${escapeHtml(adminHistoryVisitorsGroupFilter)}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Visitor / Contact</th>
            <th>Group / Organization</th>
            <th>Pax</th>
            <th>Purpose</th>
            <th>Guide</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(v => `
            <tr>
              <td><strong>${escapeHtml(v.visitDate || '—')}</strong><br><span style="color:#64748b; font-size:10px;">${escapeHtml(v.visitTime || '')}</span></td>
              <td><strong>${escapeHtml(v.visitorName)}</strong><br><span style="color:#64748b; font-size:10px;">${escapeHtml(v.contactNumber || v.email || '')}</span></td>
              <td>${escapeHtml(v.groupName || '—')}<br><span style="color:#64748b; font-size:10px;">${escapeHtml(v.groupType || 'Individual')}</span></td>
              <td style="font-weight:700;">${v.pax || 1}</td>
              <td>${escapeHtml(v.purpose || 'General Visit')}</td>
              <td>${escapeHtml(v.tourGuide || '—')}</td>
              <td>${escapeHtml(v.address || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>
        window.onload = () => { setTimeout(() => { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

function openVisitorCheckinQrModal(){
  openModal(`
    <h2>Visitor Check-in QR Code</h2>
    <p style="font-size:13px; color:var(--ink-soft); margin:-10px 0 16px; line-height:1.4;">
      Place this QR code at the entrance. Visitors can scan it to check in using their phone.
    </p>
    <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
      <img src="${Api.visitorCheckinQrUrl()}" alt="Visitor Check-in QR Code" style="max-width:100%; height:auto; border:1px solid var(--grey-200); border-radius:12px; background:#fff; padding:12px; box-shadow:var(--shadow-sm);">
      <div style="text-align:center; color:var(--ink-soft); font-size:13px;">
        <div style="font-weight:700; color:var(--ink); margin-bottom:4px;">Visitor Check-in</div>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:12px;">/checkin.html</div>
      </div>
      <a class="btn btn-primary" href="${Api.visitorCheckinQrUrl()}" download="visitor-checkin-tag.png" style="width:100%; max-width:300px; text-align:center;">⬇ Download QR Code</a>
    </div>
    <div class="modal-actions" style="margin-top:8px;">
      <button class="btn btn-primary" id="closeCheckinQrModal">Close</button>
    </div>
  `);
  document.getElementById('closeCheckinQrModal')?.addEventListener('click', closeModal);
}

// ---------------- Artifacts Log ----------------
let artifactsCache = [];
let artifactStatsCache = null;
let adminArtifactsSearch = '';
let adminArtifactsCategoryFilter = 'All';
let adminArtifactsConditionFilter = 'All';
let adminArtifactsStatusFilter = 'All';

async function renderArtifactsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading artifacts inventory log…</p></div>`;
  try{
    const [artRes, statsRes] = await Promise.all([
      Api.listArtifactLogs(),
      Api.getArtifactLogStats().catch(()=>({ stats: {} }))
    ]);
    artifactsCache = (artRes && Array.isArray(artRes.artifactLogs)) ? artRes.artifactLogs : [];
    artifactStatsCache = (statsRes && statsRes.stats) ? statsRes.stats : {};
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load artifacts log</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const stats = artifactStatsCache || {};
  const totalArtifacts = stats.totalArtifacts != null ? stats.totalArtifacts : artifactsCache.length;
  const onDisplay = stats.onDisplay || 0;
  const inStorage = stats.inStorage || 0;
  const needsMaintenance = stats.needsMaintenance || 0;

  let filtered = [...artifactsCache];
  if(adminArtifactsSearch){
    const q = adminArtifactsSearch.toLowerCase();
    filtered = filtered.filter(a =>
      (a.accessionNo || '').toLowerCase().includes(q) ||
      (a.name || '').toLowerCase().includes(q) ||
      (a.category || '').toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q) ||
      (a.donor || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q)
    );
  }
  if(adminArtifactsCategoryFilter !== 'All'){
    filtered = filtered.filter(a => (a.category || '').toLowerCase() === adminArtifactsCategoryFilter.toLowerCase());
  }
  if(adminArtifactsConditionFilter !== 'All'){
    filtered = filtered.filter(a => (a.condition || '').toLowerCase() === adminArtifactsConditionFilter.toLowerCase());
  }
  if(adminArtifactsStatusFilter !== 'All'){
    filtered = filtered.filter(a => (a.status || '').toLowerCase() === adminArtifactsStatusFilter.toLowerCase());
  }

  const uniqueCategories = Array.from(new Set(artifactsCache.map(a => a.category).filter(Boolean)));

  contentEl.innerHTML = `
    <div class="kpi-cards-grid">
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon">🏺</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${totalArtifacts}</div>
          <div class="kpi-stat-label">Total Catalogued Artifacts</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon green">🏛️</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${onDisplay}</div>
          <div class="kpi-stat-label">On Public Display</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon purple">📦</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${inStorage}</div>
          <div class="kpi-stat-label">Stored in Archives</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon orange">🛠️</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${needsMaintenance}</div>
          <div class="kpi-stat-label">Needs Care / Restoration</div>
        </div>
      </div>
    </div>

    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminArtifactsSearchInput" class="admin-search-input" placeholder="Search by accession #, artifact name, donor, room, storage…" value="${escapeHtml(adminArtifactsSearch)}">
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-export" id="exportArtifactsBtn" title="Export artifacts inventory as CSV">📥 Export CSV</button>
          <button class="btn btn-primary btn-small" id="addArtifactBtn">+ Log new artifact</button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="adminArtifactsCatSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminArtifactsCategoryFilter==='All'?'selected':''}>All Categories</option>
            ${uniqueCategories.map(c => `<option value="${escapeHtml(c)}" ${adminArtifactsCategoryFilter===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
          </select>
          <select id="adminArtifactsCondSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminArtifactsConditionFilter==='All'?'selected':''}>All Conditions</option>
            <option value="Excellent" ${adminArtifactsConditionFilter==='Excellent'?'selected':''}>Excellent</option>
            <option value="Good" ${adminArtifactsConditionFilter==='Good'?'selected':''}>Good</option>
            <option value="Fair" ${adminArtifactsConditionFilter==='Fair'?'selected':''}>Fair</option>
            <option value="Needs Restoration" ${adminArtifactsConditionFilter==='Needs Restoration'?'selected':''}>Needs Restoration</option>
            <option value="Damaged" ${adminArtifactsConditionFilter==='Damaged'?'selected':''}>Damaged</option>
          </select>
          <select id="adminArtifactsStatusSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminArtifactsStatusFilter==='All'?'selected':''}>All Statuses</option>
            <option value="On Display" ${adminArtifactsStatusFilter==='On Display'?'selected':''}>On Display</option>
            <option value="In Storage" ${adminArtifactsStatusFilter==='In Storage'?'selected':''}>In Storage</option>
            <option value="Under Restoration" ${adminArtifactsStatusFilter==='Under Restoration'?'selected':''}>Under Restoration</option>
            <option value="On Loan" ${adminArtifactsStatusFilter==='On Loan'?'selected':''}>On Loan</option>
            <option value="Deaccessioned" ${adminArtifactsStatusFilter==='Deaccessioned'?'selected':''}>Deaccessioned</option>
          </select>
          ${(adminArtifactsSearch || adminArtifactsCategoryFilter !== 'All' || adminArtifactsConditionFilter !== 'All' || adminArtifactsStatusFilter !== 'All') ? '<button type="button" class="btn btn-ghost dark btn-small" id="clearArtifactsFilters" style="padding:4px 8px; font-size:11.5px;">Reset filters</button>' : ''}
        </div>
        <span style="font-size:13px; color:var(--ink-soft);">${filtered.length} of ${artifactsCache.length} artifacts</span>
      </div>
    </div>

    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead>
          <tr>
            <th>Accession #</th>
            <th>Artifact Name</th>
            <th>Category</th>
            <th>Condition</th>
            <th>Storage / Display Location</th>
            <th>Status</th>
            <th>Donor / Acquisition</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="artifactsTableBody"></tbody>
      </table>
    </div>
    ${filtered.length === 0 ? `<div class="empty-state"><h2>No artifact records found</h2><p>No artifacts match your search and filter criteria.</p></div>` : ''}
  `;

  // Bind Events
  const searchInput = document.getElementById('adminArtifactsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminArtifactsSearch = e.target.value.trim();
      renderArtifactsTab(contentEl);
      const updated = document.getElementById('adminArtifactsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  document.getElementById('adminArtifactsCatSelect')?.addEventListener('change', (e)=>{
    adminArtifactsCategoryFilter = e.target.value;
    renderArtifactsTab(contentEl);
  });
  document.getElementById('adminArtifactsCondSelect')?.addEventListener('change', (e)=>{
    adminArtifactsConditionFilter = e.target.value;
    renderArtifactsTab(contentEl);
  });
  document.getElementById('adminArtifactsStatusSelect')?.addEventListener('change', (e)=>{
    adminArtifactsStatusFilter = e.target.value;
    renderArtifactsTab(contentEl);
  });
  document.getElementById('clearArtifactsFilters')?.addEventListener('click', ()=>{
    adminArtifactsSearch = '';
    adminArtifactsCategoryFilter = 'All';
    adminArtifactsConditionFilter = 'All';
    adminArtifactsStatusFilter = 'All';
    renderArtifactsTab(contentEl);
  });
  document.getElementById('addArtifactBtn')?.addEventListener('click', ()=>openArtifactModal(null));
  document.getElementById('exportArtifactsBtn')?.addEventListener('click', ()=>exportArtifactsCSV(filtered));

  const tbody = document.getElementById('artifactsTableBody');
  if(tbody){
    tbody.innerHTML = filtered.map(a => {
      const condClass = (a.condition || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const statusClass = (a.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      return `
        <tr>
          <td data-label="Accession #">
            <span style="font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:12px; color:var(--ink); background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px;">${escapeHtml(a.accessionNo)}</span>
          </td>
          <td data-label="Artifact Name">
            <div style="font-weight:700; color:var(--ink);">${escapeHtml(a.name)}</div>
            ${a.description ? `<div style="font-size:11.5px; color:var(--grey-400); max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(a.description)}">${escapeHtml(a.description)}</div>` : ''}
          </td>
          <td data-label="Category">
            <span class="cat-pill" style="font-size:10px;">${escapeHtml(a.category || 'Other')}</span>
          </td>
          <td data-label="Condition">
            <span class="cond-badge ${condClass}">${escapeHtml(a.condition || 'Good')}</span>
          </td>
          <td data-label="Storage / Display Location">
            <div style="font-size:13px; font-weight:600; color:var(--ink);">📍 ${escapeHtml(a.location || 'Unassigned')}</div>
          </td>
          <td data-label="Status">
            <span class="status-badge ${statusClass}">${escapeHtml(a.status || 'On Display')}</span>
          </td>
          <td data-label="Donor / Acquisition">
            <div style="font-size:12.5px; color:var(--ink);">${escapeHtml(a.donor || 'Museum Acquisition')}</div>
            <div style="font-size:11px; color:var(--grey-400);">${escapeHtml(a.acquisitionDate || '')}</div>
          </td>
          <td data-label="Actions" style="text-align:right; white-space:nowrap;">
            <button class="btn btn-ghost dark btn-small" data-edit-artifact="${a.id}" title="Edit artifact record">Edit</button>
            <button class="btn btn-danger btn-small" data-del-artifact="${a.id}" style="margin-left:4px;" title="Delete artifact record">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit-artifact]').forEach(btn => {
      btn.addEventListener('click', ()=>{
        const a = artifactsCache.find(item => item.id === btn.dataset.editArtifact);
        if(a) openArtifactModal(a);
      });
    });

    tbody.querySelectorAll('[data-del-artifact]').forEach(btn => {
      btn.addEventListener('click', async ()=>{
        const a = artifactsCache.find(item => item.id === btn.dataset.delArtifact);
        if(!a) return;
        if(!confirm(`Delete artifact record for "${a.name}" (${a.accessionNo})?`)) return;
        try{
          await Api.deleteArtifactLog(a.id);
          toast('Artifact record deleted');
          renderArtifactsTab(contentEl);
        }catch(err){ toast(err.message, true); }
      });
    });
  }
}

function exportArtifactsCSV(list){
  const headers = ['Accession #', 'Artifact Name', 'Category', 'Condition', 'Status', 'Location', 'Acquisition Date', 'Donor / Source', 'Estimated Value', 'Description', 'Notes'];
  const rows = list.map(a => [
    `"${(a.accessionNo || '').replace(/"/g, '""')}"`,
    `"${(a.name || '').replace(/"/g, '""')}"`,
    `"${(a.category || '').replace(/"/g, '""')}"`,
    `"${(a.condition || '').replace(/"/g, '""')}"`,
    `"${(a.status || '').replace(/"/g, '""')}"`,
    `"${(a.location || '').replace(/"/g, '""')}"`,
    `"${(a.acquisitionDate || '').replace(/"/g, '""')}"`,
    `"${(a.donor || '').replace(/"/g, '""')}"`,
    `"${(a.estimatedValue || '').replace(/"/g, '""')}"`,
    `"${(a.description || '').replace(/"/g, '""')}"`,
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `msbn-artifacts-inventory-${dateStr}.csv`);
  toast('Artifacts inventory CSV exported');
}

function openArtifactModal(a){
  const isEdit = Boolean(a);
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  openModal(`
    <h2>${isEdit ? 'Edit artifact log' : 'Log new artifact / specimen'}</h2>
    <div class="form-grid">
      <div class="form-field">
        <label>Accession / Catalog #</label>
        <input type="text" id="af-accession" value="${a ? escapeHtml(a.accessionNo) : ''}" placeholder="Auto-generated if empty (e.g. MSBN-2024-001)">
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="af-category">
          <option value="Marine Specimen" ${(!a || a.category==='Marine Specimen')?'selected':''}>Marine Specimen</option>
          <option value="Traditional Toy" ${a && a.category==='Traditional Toy'?'selected':''}>Traditional Toy</option>
          <option value="Historical Relic" ${a && a.category==='Historical Relic'?'selected':''}>Historical Relic</option>
          <option value="Heritage Item" ${a && a.category==='Heritage Item'?'selected':''}>Heritage Item</option>
          <option value="Environmental Exhibit" ${a && a.category==='Environmental Exhibit'?'selected':''}>Environmental Exhibit</option>
          <option value="Literature / Document" ${a && a.category==='Literature / Document'?'selected':''}>Literature / Document</option>
          <option value="Other" ${a && a.category==='Other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-field full">
        <label>Artifact / Specimen Title *</label>
        <input type="text" id="af-name" value="${a ? escapeHtml(a.name) : ''}" placeholder="e.g. Tridacna Gigas (Giant Clam) Fossil">
      </div>
      <div class="form-field">
        <label>Condition Assessment</label>
        <select id="af-condition">
          <option value="Excellent" ${a && a.condition==='Excellent'?'selected':''}>Excellent (Pristine, intact)</option>
          <option value="Good" ${(!a || a.condition==='Good')?'selected':''}>Good (Minor wear, stable)</option>
          <option value="Fair" ${a && a.condition==='Fair'?'selected':''}>Fair (Noticeable wear, needs monitoring)</option>
          <option value="Needs Restoration" ${a && a.condition==='Needs Restoration'?'selected':''}>Needs Restoration (Conservation required)</option>
          <option value="Damaged" ${a && a.condition==='Damaged'?'selected':''}>Damaged (Requires urgent care)</option>
        </select>
      </div>
      <div class="form-field">
        <label>Current Status</label>
        <select id="af-status">
          <option value="On Display" ${(!a || a.status==='On Display')?'selected':''}>On Display</option>
          <option value="In Storage" ${a && a.status==='In Storage'?'selected':''}>In Storage (Archive / Vault)</option>
          <option value="Under Restoration" ${a && a.status==='Under Restoration'?'selected':''}>Under Restoration</option>
          <option value="On Loan" ${a && a.status==='On Loan'?'selected':''}>On Loan</option>
          <option value="Deaccessioned" ${a && a.status==='Deaccessioned'?'selected':''}>Deaccessioned</option>
        </select>
      </div>
      <div class="form-field">
        <label>Storage / Display Location</label>
        <input type="text" id="af-location" value="${a ? escapeHtml(a.location) : ''}" placeholder="e.g. Marine Gallery - Case 3B">
      </div>
      <div class="form-field">
        <label>Acquisition Date</label>
        <input type="date" id="af-date" value="${a ? escapeHtml(a.acquisitionDate) : defaultDate}">
      </div>
      <div class="form-field">
        <label>Donor / Source / Acquisition Record</label>
        <input type="text" id="af-donor" value="${a ? escapeHtml(a.donor) : ''}" placeholder="e.g. Sagay Marine Sanctuary Foundation">
      </div>
      <div class="form-field">
        <label>Estimated Valuation (optional)</label>
        <input type="text" id="af-value" value="${a ? escapeHtml(a.estimatedValue) : ''}" placeholder="e.g. ₱25,000 or N/A">
      </div>
      <div class="form-field full">
        <label>Physical Description & Dimensions</label>
        <textarea id="af-desc" rows="2" placeholder="Material, measurements, weight, historical origin...">${a ? escapeHtml(a.description) : ''}</textarea>
      </div>
      <div class="form-field full">
        <label>Conservation Notes / Handling Instructions</label>
        <textarea id="af-notes" rows="2" placeholder="Storage humidity, temperature, handling gloves needed, restoration history...">${a ? escapeHtml(a.notes) : ''}</textarea>
      </div>
      <div class="form-error" id="afError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="afCancel">Cancel</button>
      <button class="btn btn-primary" id="afSave">${isEdit ? 'Save changes' : 'Log artifact'}</button>
    </div>
  `);

  document.getElementById('afCancel').addEventListener('click', closeModal);
  const saveBtn = document.getElementById('afSave');
  saveBtn.addEventListener('click', async ()=>{
    const name = document.getElementById('af-name').value.trim();
    const errorEl = document.getElementById('afError');
    if(!name){
      errorEl.textContent = 'Artifact / specimen title is required.';
      return;
    }

    const payload = {
      accessionNo: document.getElementById('af-accession').value.trim(),
      name,
      category: document.getElementById('af-category').value,
      condition: document.getElementById('af-condition').value,
      status: document.getElementById('af-status').value,
      location: document.getElementById('af-location').value.trim(),
      acquisitionDate: document.getElementById('af-date').value,
      donor: document.getElementById('af-donor').value.trim(),
      estimatedValue: document.getElementById('af-value').value.trim(),
      description: document.getElementById('af-desc').value.trim(),
      notes: document.getElementById('af-notes').value.trim()
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try{
      if(isEdit){
        await Api.updateArtifactLog(a.id, payload);
        toast('Artifact log updated');
      } else {
        await Api.createArtifactLog(payload);
        toast('Artifact logged successfully');
      }
      closeModal();
      renderDashboard();
    }catch(err){
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save changes' : 'Log artifact';
    }
  });
}

// ---------------- Programs ----------------
let programsCache = [];
let adminProgramsSearch = '';

async function renderProgramsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading programs…</p></div>`;
  try{
    const { programs } = await Api.listPrograms();
    programsCache = programs || [];
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load programs</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  let filteredPrograms = [...programsCache];
  if(adminProgramsSearch){
    const q = adminProgramsSearch.toLowerCase();
    filteredPrograms = filteredPrograms.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.ageRange || '').toLowerCase().includes(q) ||
      (p.schedule || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminProgramsSearchInput" class="admin-search-input" placeholder="Search programs by title, age, schedule…" value="${escapeHtml(adminProgramsSearch)}">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; color:var(--ink-soft);">${filteredPrograms.length} of ${programsCache.length} programs</span>
          <button class="btn btn-primary btn-small" id="addProgramBtn">+ Add program</button>
        </div>
      </div>
    </div>
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead><tr><th>Title</th><th>Ages</th><th>Schedule</th><th></th></tr></thead>
        <tbody id="programsBody"></tbody>
      </table>
    </div>
    ${filteredPrograms.length===0 ? `<div class="empty-state"><h2>No matching programs</h2><p>No programs found matching "${escapeHtml(adminProgramsSearch)}".</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminProgramsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminProgramsSearch = e.target.value.trim();
      renderProgramsTab(contentEl);
      const updated = document.getElementById('adminProgramsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  document.getElementById('addProgramBtn').addEventListener('click', ()=>openProgramModal(null));
  const tbody = document.getElementById('programsBody');
  tbody.innerHTML = filteredPrograms.map(p => `
    <tr>
      <td class="title-cell" data-label="Title">${escapeHtml(p.title)} ${p.videoUrl ? '<span class="video-badge" style="font-size:10.5px;">▶ Video</span>' : ''}</td>
      <td data-label="Ages" style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(p.ageRange||'—')}</td>
      <td data-label="Schedule" style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(p.schedule||'—')}</td>
      <td data-label="Actions"><div class="row-actions">
        <button class="btn btn-ghost dark btn-small" data-edit-program="${p.id}">Edit</button>
        <button class="btn btn-danger btn-small" data-delete-program="${p.id}">Delete</button>
      </div></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit-program]').forEach(b=>b.addEventListener('click', ()=>openProgramModal(b.dataset.editProgram)));
  tbody.querySelectorAll('[data-delete-program]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Delete this program?')) return;
    try{ await Api.deleteProgram(b.dataset.deleteProgram); toast('Program deleted'); renderDashboard(); }
    catch(e){ toast(e.message, true); }
  }));
}

function openProgramModal(id){
  const p = id ? programsCache.find(x=>x.id===id) : null;
  let pendingImagePaths = p ? (Array.isArray(p.imagePaths) ? [...p.imagePaths] : (p.imagePath ? [p.imagePath] : [])) : [];
  let videoUrl = p && p.videoUrl ? p.videoUrl : '';

  openModal(`
    <h2>${p ? 'Edit program' : 'Add program'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title</label><input type="text" id="pf-title" value="${p?escapeHtml(p.title):''}" placeholder="e.g. Junior Museum Guide Program"></div>
      <div class="form-field"><label>Age range</label><input type="text" id="pf-age" value="${p?escapeHtml(p.ageRange):''}" placeholder="e.g. 7–12"></div>
      <div class="form-field"><label>Schedule</label><input type="text" id="pf-schedule" value="${p?escapeHtml(p.schedule):''}" placeholder="e.g. Ongoing cohorts"></div>
      <div class="form-field full">
        <label>Video (optional — YouTube / Vimeo link or upload video)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="pf-video" value="${escapeHtml(videoUrl)}" placeholder="e.g. https://www.youtube.com/watch?v=... or upload video">
          <button type="button" class="btn btn-ghost dark btn-small" id="pf-upload-video-btn">Upload video</button>
          <input type="file" id="pf-video-file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display:none;">
        </div>
        <div id="pfVideoStatus" style="font-size:12px; color:var(--ink-soft); margin-top:4px;"></div>
      </div>
      <div class="form-field full">
        <label>Photos (you can select multiple for a swipeable album)</label>
        <input type="file" id="pf-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
        <div class="file-drop" id="pf-drop">Click or drop photos here (Ctrl/Cmd or Shift to select multiple)</div>
        <div class="file-hint">Tip: you can also hold Ctrl/Cmd or Shift to select multiple files.</div>
        <div class="image-preview-list" id="pfImagePreviewList"></div>
        <div id="pfUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full"><label>Description</label><textarea id="pf-desc" placeholder="What this program is about…">${p?escapeHtml(p.description):''}</textarea></div>
      <div class="form-error" id="pfError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="pfCancel">Cancel</button>
      <button class="btn btn-primary" id="pfSave">${p?'Save changes':'Add program'}</button>
    </div>`);

  ensureMultipleInput('pf-image-file');
  renderImagePreviewList(pendingImagePaths, 'pfImagePreviewList');

  const pfVideoBtn = document.getElementById('pf-upload-video-btn');
  const pfVideoFile = document.getElementById('pf-video-file');
  const pfVideoInput = document.getElementById('pf-video');
  const pfVideoStatus = document.getElementById('pfVideoStatus');
  if(pfVideoBtn && pfVideoFile){
    pfVideoBtn.addEventListener('click', ()=>pfVideoFile.click());
    pfVideoFile.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      pfVideoStatus.textContent = 'Uploading video… (this may take a few moments)';
      try{
        const { path } = await Api.uploadMedia(file);
        pfVideoInput.value = path;
        pfVideoStatus.textContent = 'Video uploaded successfully!';
      }catch(err){ pfVideoStatus.textContent = 'Upload failed: ' + err.message; }
    });
  }

  const pfInput = document.getElementById('pf-image-file');
  const pfDrop = document.getElementById('pf-drop');
  if(pfDrop){
    pfDrop.addEventListener('click', ()=>pfInput.click());
    pfDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); pfDrop.classList.add('dragover'); });
    pfDrop.addEventListener('dragleave', ()=>pfDrop.classList.remove('dragover'));
    pfDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); pfDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const status = document.getElementById('pfUploadStatus');
      status.textContent = 'Uploading…';
      try{
        for(const file of files){
          const { path } = await Api.uploadImage(file);
          pendingImagePaths.push(path);
        }
        renderImagePreviewList(pendingImagePaths, 'pfImagePreviewList');
        status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }
  pfInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(files.length === 0) return;
    const status = document.getElementById('pfUploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        pendingImagePaths.push(path);
      }
      renderImagePreviewList(pendingImagePaths, 'pfImagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      e.target.value = '';
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });
  document.getElementById('pfCancel').addEventListener('click', closeModal);
  document.getElementById('pfSave').addEventListener('click', async ()=>{
    const title = document.getElementById('pf-title').value.trim();
    const errorEl = document.getElementById('pfError');
    if(!title){ errorEl.textContent = 'Title is required.'; return; }
    const payload = {
      title,
      ageRange: document.getElementById('pf-age').value.trim(),
      schedule: document.getElementById('pf-schedule').value.trim(),
      imagePaths: pendingImagePaths,
      videoUrl: pfVideoInput.value.trim(),
      description: document.getElementById('pf-desc').value.trim()
    };
    try{
      if(p) await Api.updateProgram(p.id, payload); else await Api.createProgram(payload);
      toast(p ? 'Program updated' : 'Program added');
      closeModal();
      renderDashboard();
    }catch(err){ errorEl.textContent = err.message; }
  });
}

// ---------------- Events ----------------
let eventsCache = [];
let adminEventsSearch = '';
let adminEventsTimeFilter = 'all';

async function renderEventsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading events…</p></div>`;
  try{
    const { events } = await Api.listEvents();
    eventsCache = events || [];
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load events</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  let filteredEvents = [...eventsCache];
  const today = new Date();
  today.setHours(0,0,0,0);

  if(adminEventsTimeFilter !== 'all'){
    if(adminEventsTimeFilter === 'upcoming'){
      filteredEvents = filteredEvents.filter(ev => {
        if(!ev.date) return false;
        const d = new Date(ev.date);
        return !isNaN(d.getTime()) && d >= today;
      });
    } else if(adminEventsTimeFilter === 'past'){
      filteredEvents = filteredEvents.filter(ev => {
        if(!ev.date) return true;
        const d = new Date(ev.date);
        return !isNaN(d.getTime()) && d < today;
      });
    }
  }

  if(adminEventsSearch){
    const q = adminEventsSearch.toLowerCase();
    filteredEvents = filteredEvents.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q) ||
      (e.date || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    );
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminEventsSearchInput" class="admin-search-input" placeholder="Search events by title, date, venue…" value="${escapeHtml(adminEventsSearch)}">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; color:var(--ink-soft);">${filteredEvents.length} of ${eventsCache.length} events</span>
          <button class="btn btn-primary btn-small" id="addEventBtn">+ Add event</button>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;" id="adminEventsFilters">
        <button class="filter-chip ${adminEventsTimeFilter==='all'?'active':''}" data-time="all">All Events (${eventsCache.length})</button>
        <button class="filter-chip ${adminEventsTimeFilter==='upcoming'?'active':''}" data-time="upcoming">Upcoming</button>
        <button class="filter-chip ${adminEventsTimeFilter==='past'?'active':''}" data-time="past">Past Events</button>
      </div>
    </div>
    <div class="admin-table-wrap" style="margin-top:12px;">
      <table class="ledger">
        <thead><tr><th>Title</th><th>Date</th><th>Location</th><th></th></tr></thead>
        <tbody id="eventsBody"></tbody>
      </table>
    </div>
    ${filteredEvents.length===0 ? `<div class="empty-state"><h2>No matching events</h2><p>No events found matching your search and filter criteria.</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminEventsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminEventsSearch = e.target.value.trim();
      renderEventsTab(contentEl);
      const updated = document.getElementById('adminEventsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  contentEl.querySelectorAll('#adminEventsFilters [data-time]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      adminEventsTimeFilter = btn.dataset.time;
      renderEventsTab(contentEl);
    });
  });

  document.getElementById('addEventBtn').addEventListener('click', ()=>openEventModal(null));
  const tbody = document.getElementById('eventsBody');
  tbody.innerHTML = filteredEvents.map(e => `
    <tr>
      <td class="title-cell" data-label="Title">${escapeHtml(e.title)} ${e.videoUrl ? '<span class="video-badge" style="font-size:10.5px;">▶ Video</span>' : ''}</td>
      <td data-label="Date" style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(e.date||'—')}</td>
      <td data-label="Location" style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(e.location||'—')}</td>
      <td data-label="Actions"><div class="row-actions">
        <button class="btn btn-ghost dark btn-small" data-edit-event="${e.id}">Edit</button>
        <button class="btn btn-danger btn-small" data-delete-event="${e.id}">Delete</button>
      </div></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit-event]').forEach(b=>b.addEventListener('click', ()=>openEventModal(b.dataset.editEvent)));
  tbody.querySelectorAll('[data-delete-event]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Delete this event?')) return;
    try{ await Api.deleteEvent(b.dataset.deleteEvent); toast('Event deleted'); renderDashboard(); }
    catch(e){ toast(e.message, true); }
  }));
}

function openEventModal(id){
  const ev = id ? eventsCache.find(x=>x.id===id) : null;
  let pendingImagePaths = ev ? (Array.isArray(ev.imagePaths) ? [...ev.imagePaths] : (ev.imagePath ? [ev.imagePath] : [])) : [];
  let videoUrl = ev && ev.videoUrl ? ev.videoUrl : '';

  openModal(`
    <h2>${ev ? 'Edit event' : 'Add event'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title</label><input type="text" id="ef-title" value="${ev?escapeHtml(ev.title):''}" placeholder="e.g. Adlaw Sang Kabataan 2026"></div>
      <div class="form-field"><label>Date</label><input type="date" id="ef-date" value="${ev&&ev.date?escapeHtml(ev.date):''}"></div>
      <div class="form-field"><label>Location</label><input type="text" id="ef-location" value="${ev?escapeHtml(ev.location):''}" placeholder="e.g. Museo Sang Bata sa Negros"></div>
      <div class="form-field full">
        <label>Video (optional — YouTube / Vimeo link or upload video)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="ef-video" value="${escapeHtml(videoUrl)}" placeholder="e.g. https://www.youtube.com/watch?v=... or upload video">
          <button type="button" class="btn btn-ghost dark btn-small" id="ef-upload-video-btn">Upload video</button>
          <input type="file" id="ef-video-file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display:none;">
        </div>
        <div id="efVideoStatus" style="font-size:12px; color:var(--ink-soft); margin-top:4px;"></div>
      </div>
      <div class="form-field full">
        <label>Photos (you can select multiple for a swipeable album)</label>
        <input type="file" id="ef-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
        <div class="file-drop" id="ef-drop">Click or drop photos here (Ctrl/Cmd or Shift to select multiple)</div>
        <div class="file-hint">Tip: you can also hold Ctrl/Cmd or Shift to select multiple files.</div>
        <div class="image-preview-list" id="efImagePreviewList"></div>
        <div id="efUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full"><label>Description</label><textarea id="ef-desc" placeholder="What happened / what to expect…">${ev?escapeHtml(ev.description):''}</textarea></div>
      <div class="form-error" id="efError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="efCancel">Cancel</button>
      <button class="btn btn-primary" id="efSave">${ev?'Save changes':'Add event'}</button>
    </div>`);

  ensureMultipleInput('ef-image-file');
  renderImagePreviewList(pendingImagePaths, 'efImagePreviewList');

  const efVideoBtn = document.getElementById('ef-upload-video-btn');
  const efVideoFile = document.getElementById('ef-video-file');
  const efVideoInput = document.getElementById('ef-video');
  const efVideoStatus = document.getElementById('efVideoStatus');
  if(efVideoBtn && efVideoFile){
    efVideoBtn.addEventListener('click', ()=>efVideoFile.click());
    efVideoFile.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      efVideoStatus.textContent = 'Uploading video… (this may take a few moments)';
      try{
        const { path } = await Api.uploadMedia(file);
        efVideoInput.value = path;
        efVideoStatus.textContent = 'Video uploaded successfully!';
      }catch(err){ efVideoStatus.textContent = 'Upload failed: ' + err.message; }
    });
  }

  const efInput = document.getElementById('ef-image-file');
  const efDrop = document.getElementById('ef-drop');
  if(efDrop){
    efDrop.addEventListener('click', ()=>efInput.click());
    efDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); efDrop.classList.add('dragover'); });
    efDrop.addEventListener('dragleave', ()=>efDrop.classList.remove('dragover'));
    efDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); efDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const status = document.getElementById('efUploadStatus');
      status.textContent = 'Uploading…';
      try{
        for(const file of files){
          const { path } = await Api.uploadImage(file);
          pendingImagePaths.push(path);
        }
        renderImagePreviewList(pendingImagePaths, 'efImagePreviewList');
        status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }
  efInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(files.length === 0) return;
    const status = document.getElementById('efUploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        pendingImagePaths.push(path);
      }
      renderImagePreviewList(pendingImagePaths, 'efImagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      e.target.value = '';
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });
  document.getElementById('efCancel').addEventListener('click', closeModal);
  document.getElementById('efSave').addEventListener('click', async ()=>{
    const title = document.getElementById('ef-title').value.trim();
    const errorEl = document.getElementById('efError');
    if(!title){ errorEl.textContent = 'Title is required.'; return; }
    const payload = {
      title,
      date: document.getElementById('ef-date').value,
      location: document.getElementById('ef-location').value.trim(),
      imagePaths: pendingImagePaths,
      videoUrl: efVideoInput.value.trim(),
      description: document.getElementById('ef-desc').value.trim()
    };
    try{
      if(ev) await Api.updateEvent(ev.id, payload); else await Api.createEvent(payload);
      toast(ev ? 'Event updated' : 'Event added');
      closeModal();
      renderDashboard();
    }catch(err){ errorEl.textContent = err.message; }
  });
}

// ---------------- Gallery ----------------
let galleryCache = [];
let gallerySelection = new Set();
let adminGallerySearch = '';
let adminGalleryTypeFilter = 'all';

async function renderGalleryTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading gallery…</p></div>`;
  try{
    const { gallery } = await Api.listGallery();
    galleryCache = gallery || [];
    gallerySelection.clear();
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load gallery</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  let filteredGallery = [...galleryCache];

  if(adminGalleryTypeFilter !== 'all'){
    if(adminGalleryTypeFilter === 'video'){
      filteredGallery = filteredGallery.filter(g => Boolean(g.videoUrl));
    } else if(adminGalleryTypeFilter === 'photo'){
      filteredGallery = filteredGallery.filter(g => !g.videoUrl);
    }
  }

  if(adminGallerySearch){
    const q = adminGallerySearch.toLowerCase();
    filteredGallery = filteredGallery.filter(g =>
      (g.title || '').toLowerCase().includes(q) ||
      (g.caption || '').toLowerCase().includes(q)
    );
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminGallerySearchInput" class="admin-search-input" placeholder="Search gallery posts by title, caption…" value="${escapeHtml(adminGallerySearch)}">
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn btn-danger btn-small" id="deleteSelectedGalleryBtn" disabled>Delete selected</button>
          <button class="btn btn-primary btn-small" id="addGalleryBtn">+ Add post / photos / video</button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;" id="adminGalleryFilters">
          <button class="filter-chip ${adminGalleryTypeFilter==='all'?'active':''}" data-type="all">All Media (${galleryCache.length})</button>
          <button class="filter-chip ${adminGalleryTypeFilter==='photo'?'active':''}" data-type="photo">Photos Only</button>
          <button class="filter-chip ${adminGalleryTypeFilter==='video'?'active':''}" data-type="video">Videos Only</button>
        </div>
        <span id="gallerySelectionCount" style="font-size:13px; color:var(--ink-soft);">Select posts to delete</span>
      </div>
    </div>
    <div class="gallery-grid" style="padding:16px 26px 26px;" id="galleryAdminGrid"></div>
    ${filteredGallery.length===0 ? `<div class="empty-state"><h2>No matching gallery posts</h2><p>No gallery items found matching your search and filter criteria.</p></div>` : ''}
  `;

  const searchInput = document.getElementById('adminGallerySearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminGallerySearch = e.target.value.trim();
      renderGalleryTab(contentEl);
      const updated = document.getElementById('adminGallerySearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  contentEl.querySelectorAll('#adminGalleryFilters [data-type]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      adminGalleryTypeFilter = btn.dataset.type;
      renderGalleryTab(contentEl);
    });
  });

  document.getElementById('addGalleryBtn').addEventListener('click', ()=>openGalleryModal(null));
  document.getElementById('deleteSelectedGalleryBtn').addEventListener('click', async ()=>{
    if(gallerySelection.size === 0) return;
    if(!confirm(`Delete ${gallerySelection.size} selected post${gallerySelection.size === 1 ? '' : 's'}?`)) return;
    try{
      for(const id of [...gallerySelection]){
        await Api.deleteGalleryItem(id);
      }
      toast(`${gallerySelection.size} post${gallerySelection.size === 1 ? '' : 's'} deleted`);
      gallerySelection.clear();
      renderDashboard();
    }catch(e){
      toast(e.message, true);
    }
  });

  const grid = document.getElementById('galleryAdminGrid');
  grid.innerHTML = filteredGallery.map(g => {
    const paths = Array.isArray(g.imagePaths) && g.imagePaths.length ? g.imagePaths : (g.imagePath ? [g.imagePath] : []);
    const primary = paths[0] || '';
    return `
    <div class="gallery-item">
      <label class="gallery-item-checkbox">
        <input type="checkbox" class="gallery-select" data-id="${g.id}" ${gallerySelection.has(g.id)?'checked':''}>
      </label>
      ${(g.videoUrl && paths.length > 0) ? `<div class="carousel-badge" style="background:rgba(217,79,61,0.9);">▶ Video + 📷 ${paths.length}</div>` : (g.videoUrl ? `<div class="carousel-badge" style="background:rgba(217,79,61,0.85);">▶ Video</div>` : (paths.length > 1 ? `<div class="carousel-badge">📷 ${paths.length} photos</div>` : ''))}
      ${primary ? `<img src="${escapeHtml(primary)}" alt="${escapeHtml(g.title)}">` : (g.videoUrl ? `<div style="width:100%; height:100%; background:#000; display:flex; align-items:center; justify-content:center; color:#fff; font-size:32px;">▶</div>` : `<div style="width:100%; height:100%; background:var(--teal-light); display:flex; align-items:center; justify-content:center; font-size:32px;">📷</div>`)}
      <div class="caption">
        ${g.title ? `<b>${escapeHtml(g.title)}</b>` : ''}
        ${g.caption ? `<span>${escapeHtml(g.caption)}</span>` : ''}
        <div style="display:flex; gap:6px; margin-top:6px; pointer-events:auto;">
          <button class="btn btn-ghost btn-small" style="color:#fff; border-color:rgba(255,255,255,0.4);" data-edit-gallery="${g.id}">Edit</button>
          <button class="btn btn-danger btn-small" data-delete-gallery="${g.id}">Delete</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
  grid.querySelectorAll('.gallery-select').forEach(chk=>chk.addEventListener('change', e=>{
    const id = e.target.dataset.id;
    if(!id) return;
    if(e.target.checked) gallerySelection.add(id);
    else gallerySelection.delete(id);
    updateGallerySelectionControls();
  }));
  grid.querySelectorAll('[data-edit-gallery]').forEach(b=>b.addEventListener('click', ()=>openGalleryModal(b.dataset.editGallery)));
  grid.querySelectorAll('[data-delete-gallery]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Delete this gallery post?')) return;
    try{ await Api.deleteGalleryItem(b.dataset.deleteGallery); toast('Post deleted'); renderDashboard(); }
    catch(e){ toast(e.message, true); }
  }));

  function updateGallerySelectionControls(){
    const deleteSelectedBtn = document.getElementById('deleteSelectedGalleryBtn');
    const selectionCountEl = document.getElementById('gallerySelectionCount');
    if(deleteSelectedBtn) deleteSelectedBtn.disabled = gallerySelection.size === 0;
    if(selectionCountEl) selectionCountEl.textContent = gallerySelection.size > 0 ? `${gallerySelection.size} selected` : 'Select posts to delete';
  }
}

function openGalleryModal(id){
  const g = id ? galleryCache.find(x=>x.id===id) : null;
  let pendingImagePaths = g ? (Array.isArray(g.imagePaths) && g.imagePaths.length ? [...g.imagePaths] : (g.imagePath ? [g.imagePath] : [])) : [];
  let videoUrl = g && g.videoUrl ? g.videoUrl : '';

  openModal(`
    <h2>${g ? 'Edit gallery post' : 'Add gallery post'}</h2>
    <div class="form-grid">
      <div class="form-field full">
        <label>Video (optional — YouTube link or upload MP4/WebM video)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="gf-video" value="${escapeHtml(videoUrl)}" placeholder="e.g. https://www.youtube.com/watch?v=... or upload video">
          <button type="button" class="btn btn-ghost dark btn-small" id="gf-upload-video-btn">Upload video</button>
          <input type="file" id="gf-video-file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display:none;">
        </div>
        <div id="gfVideoStatus" style="font-size:12px; color:var(--ink-soft); margin-top:4px;"></div>
      </div>
      <div class="form-field full">
        <label>Photos (you can select multiple for a swipeable album)</label>
        <input type="file" id="gf-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
        <div class="file-drop" id="gf-drop">Click or drop photos here (select multiple to create a swipeable album)</div>
        <div class="file-hint">Tip: you can hold Ctrl/Cmd or Shift to select multiple photos at once.</div>
        <div class="image-preview-list" id="gfImagePreviewList"></div>
        <div id="gfUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full"><label>Title (optional)</label><input type="text" id="gf-title" value="${g?escapeHtml(g.title):''}" placeholder="e.g. Coral Reef Workshop"></div>
      <div class="form-field full"><label>Caption (optional)</label><input type="text" id="gf-caption" value="${g?escapeHtml(g.caption):''}" placeholder="Short caption shown with the photos or video"></div>
      <div class="form-error" id="gfError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="gfCancel">Cancel</button>
      <button class="btn btn-primary" id="gfSave">${g?'Save changes':'Add post'}</button>
    </div>`);

  ensureMultipleInput('gf-image-file');
  renderImagePreviewList(pendingImagePaths, 'gfImagePreviewList');

  const gfVideoBtn = document.getElementById('gf-upload-video-btn');
  const gfVideoFile = document.getElementById('gf-video-file');
  const gfVideoInput = document.getElementById('gf-video');
  const gfVideoStatus = document.getElementById('gfVideoStatus');
  if(gfVideoBtn && gfVideoFile){
    gfVideoBtn.addEventListener('click', ()=>gfVideoFile.click());
    gfVideoFile.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      gfVideoStatus.textContent = 'Uploading video… (this may take a few moments)';
      try{
        const { path } = await Api.uploadMedia(file);
        gfVideoInput.value = path;
        gfVideoStatus.textContent = 'Video uploaded successfully!';
      }catch(err){ gfVideoStatus.textContent = 'Upload failed: ' + err.message; }
    });
  }

  const gfInput = document.getElementById('gf-image-file');
  const gfDrop = document.getElementById('gf-drop');
  if(gfDrop){
    gfDrop.addEventListener('click', ()=>gfInput.click());
    gfDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); gfDrop.classList.add('dragover'); });
    gfDrop.addEventListener('dragleave', ()=>gfDrop.classList.remove('dragover'));
    gfDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); gfDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const status = document.getElementById('gfUploadStatus');
      status.textContent = 'Uploading…';
      try{
        for(const file of files){
          const { path } = await Api.uploadImage(file);
          pendingImagePaths.push(path);
        }
        renderImagePreviewList(pendingImagePaths, 'gfImagePreviewList');
        status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }

  gfInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    const status = document.getElementById('gfUploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        pendingImagePaths.push(path);
      }
      renderImagePreviewList(pendingImagePaths, 'gfImagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
      e.target.value = '';
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });

  document.getElementById('gfCancel').addEventListener('click', closeModal);
  document.getElementById('gfSave').addEventListener('click', async ()=>{
    const errorEl = document.getElementById('gfError');
    const vUrl = gfVideoInput.value.trim();
    if(!pendingImagePaths.length && !vUrl){ errorEl.textContent = 'Please upload at least one photo or add a video.'; return; }
    const title = document.getElementById('gf-title').value.trim();
    const caption = document.getElementById('gf-caption').value.trim();
    const payload = {
      imagePaths: pendingImagePaths,
      imagePath: pendingImagePaths[0] || '',
      videoUrl: vUrl,
      title,
      caption
    };
    try{
      if(g){
        await Api.updateGalleryItem(g.id, payload);
        toast('Gallery post updated');
      } else {
        await Api.createGalleryItem(payload);
        toast('Gallery post added');
      }
      closeModal();
      renderDashboard();
    }catch(err){ errorEl.textContent = err.message; }
  });
}

boot();

// ─── Museum Info ───
async function renderMuseumInfoTab(contentEl){
  let info = {};
  try{
    const res = await Api.getMuseumInfo();
    info = res.museumInfo || {};
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load museum info</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  contentEl.innerHTML = `
    <div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <button class="btn btn-primary btn-small" id="editMuseumInfoBtn">✏️ Edit Museum Info</button>
      </div>
    </div>
    <div style="padding:20px 26px; display:flex; flex-direction:column; gap:20px;">
      <div class="info-card">
        <h3 class="info-card-header">
          <span class="info-card-icon">🏛️</span> Basic Information
        </h3>
        <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escapeHtml(info.name || '—')}</span></div>
        <div class="info-row"><span class="info-label">Tagline</span><span class="info-value">${escapeHtml(info.tagline || '—')}</span></div>
        <div class="info-row"><span class="info-label">Address</span><span class="info-value">${escapeHtml(info.address || '—')}</span></div>
        <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${escapeHtml(info.phone || '—')}</span></div>
        <div class="info-row"><span class="info-label">Hours</span><span class="info-value">${escapeHtml(info.hours || '—')}</span></div>
      </div>

      <div class="info-card">
        <h3 class="info-card-header">
          <span class="info-card-icon">📖</span> About
        </h3>
        <div class="info-value" style="white-space:pre-wrap; font-weight:400; line-height:1.65;">${escapeHtml(info.about || '—')}</div>
      </div>

      <div class="info-card">
        <h3 class="info-card-header">
          <span class="info-card-icon">🎟️</span> Entrance Fees
        </h3>
        <ul class="info-list">
          ${(info.entranceFees || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}
        </ul>
      </div>

      <div class="info-card">
        <h3 class="info-card-header">
          <span class="info-card-icon">🔗</span> Footer Links
        </h3>
        <ul class="info-list">
          ${(info.footerLinks || []).map(f => `<li><strong class="info-link-label">${escapeHtml(f.label)}</strong> <span class="info-link-arrow">→</span> <span class="info-link-href">${escapeHtml(f.href)}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  document.getElementById('editMuseumInfoBtn')?.addEventListener('click', ()=>openMuseumInfoModal(info));
}

function openMuseumInfoModal(info){
  const feesHtml = (info.entranceFees || []).map((f, i) => `
    <div class="form-field" style="display:flex; gap:8px; align-items:center;">
      <input type="text" id="mi-fee-${i}" value="${escapeHtml(f)}" placeholder="Fee description" style="flex:1;">
      <button type="button" class="btn btn-ghost dark btn-small" data-remove-fee="${i}" style="flex-shrink:0;">Remove</button>
    </div>
  `).join('');

  const linksHtml = (info.footerLinks || []).map((l, i) => `
    <div class="form-field" style="display:flex; gap:8px; align-items:center;">
      <input type="text" id="mi-link-label-${i}" value="${escapeHtml(l.label)}" placeholder="Label" style="width:140px;">
      <input type="text" id="mi-link-href-${i}" value="${escapeHtml(l.href)}" placeholder="URL (e.g. /donate.html)" style="flex:1;">
      <button type="button" class="btn btn-ghost dark btn-small" data-remove-link="${i}" style="flex-shrink:0;">Remove</button>
    </div>
  `).join('');

  openModal(`
    <h2>Edit Museum Information</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Museum Name *</label><input type="text" id="mi-name" value="${escapeHtml(info.name || '')}" required></div>
      <div class="form-field full"><label>Tagline *</label><textarea id="mi-tagline" rows="2" placeholder="Subtitle shown in footer...">${escapeHtml(info.tagline || '')}</textarea></div>
      <div class="form-field full"><label>Address *</label><textarea id="mi-address" rows="2" placeholder="Full address">${escapeHtml(info.address || '')}</textarea></div>
      <div class="form-field"><label>Phone *</label><input type="text" id="mi-phone" value="${escapeHtml(info.phone || '')}" required></div>
      <div class="form-field full"><label>Hours *</label><textarea id="mi-hours" rows="2" placeholder="Opening hours">${escapeHtml(info.hours || '')}</textarea></div>
      <div class="form-field full"><label>About</label><textarea id="mi-about" rows="4" placeholder="About the museum...">${escapeHtml(info.about || '')}</textarea></div>
      
      <div class="form-field full">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <label>Entrance Fees</label>
          <button type="button" class="btn btn-primary btn-small" id="addFeeBtn">+ Add Fee</button>
        </div>
        <div id="feeFields">${feesHtml || '<div class="form-field" style="display:flex; gap:8px; align-items:center;"><input type="text" id="mi-fee-0" value="" placeholder="Fee description" style="flex:1;"><button type="button" class="btn btn-ghost dark btn-small" data-remove-fee="0" style="flex-shrink:0;">Remove</button></div>'}</div>
      </div>

      <div class="form-field full">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <label>Footer Links</label>
          <button type="button" class="btn btn-primary btn-small" id="addLinkBtn">+ Add Link</button>
        </div>
        <div id="linkFields">${linksHtml || '<div class="form-field" style="display:flex; gap:8px; align-items:center;"><input type="text" id="mi-link-label-0" value="💖 Donate" placeholder="Label" style="width:140px;"><input type="text" id="mi-link-href-0" value="/donate.html" placeholder="URL" style="flex:1;"><button type="button" class="btn btn-ghost dark btn-small" data-remove-link="0" style="flex-shrink:0;">Remove</button></div>'}</div>
      </div>

      <div class="form-error" id="miError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="miCancel">Cancel</button>
      <button class="btn btn-primary" id="miSave">Save changes</button>
    </div>
  `);

  let feeIndex = (info.entranceFees || []).length;
  let linkIndex = (info.footerLinks || []).length;

  const feeFields = document.getElementById('feeFields');
  const linkFields = document.getElementById('linkFields');

  document.getElementById('addFeeBtn')?.addEventListener('click', ()=>{
    const id = feeIndex++;
    const div = document.createElement('div');
    div.className = 'form-field';
    div.style.cssText = 'display:flex; gap:8px; align-items:center;';
    div.innerHTML = `<input type="text" id="mi-fee-${id}" value="" placeholder="Fee description" style="flex:1;"><button type="button" class="btn btn-ghost dark btn-small" data-remove-fee="${id}" style="flex-shrink:0;">Remove</button>`;
    feeFields.appendChild(div);
  });

  document.getElementById('addLinkBtn')?.addEventListener('click', ()=>{
    const id = linkIndex++;
    const div = document.createElement('div');
    div.className = 'form-field';
    div.style.cssText = 'display:flex; gap:8px; align-items:center;';
    div.innerHTML = `<input type="text" id="mi-link-label-${id}" value="" placeholder="Label" style="width:140px;"><input type="text" id="mi-link-href-${id}" value="" placeholder="URL (e.g. /donate.html)" style="flex:1;"><button type="button" class="btn btn-ghost dark btn-small" data-remove-link="${id}" style="flex-shrink:0;">Remove</button>`;
    linkFields.appendChild(div);
  });

  feeFields.addEventListener('click', e=>{
    if(e.target.matches('[data-remove-fee]')){
      e.target.closest('.form-field').remove();
    }
  });

  linkFields.addEventListener('click', e=>{
    if(e.target.matches('[data-remove-link]')){
      e.target.closest('.form-field').remove();
    }
  });

  document.getElementById('miCancel')?.addEventListener('click', closeModal);
  document.getElementById('miSave')?.addEventListener('click', async ()=>{
    const errorEl = document.getElementById('miError');
    const name = document.getElementById('mi-name').value.trim();
    if(!name){ errorEl.textContent = 'Museum name is required.'; return; }
    const tagline = document.getElementById('mi-tagline').value.trim();
    if(!tagline){ errorEl.textContent = 'Tagline is required.'; return; }
    const address = document.getElementById('mi-address').value.trim();
    if(!address){ errorEl.textContent = 'Address is required.'; return; }
    const phone = document.getElementById('mi-phone').value.trim();
    if(!phone){ errorEl.textContent = 'Phone is required.'; return; }
    const hours = document.getElementById('mi-hours').value.trim();
    if(!hours){ errorEl.textContent = 'Hours is required.'; return; }

    // Collect fees
    const feeInputs = feeFields.querySelectorAll('input[id^="mi-fee-"]');
    const entranceFees = Array.from(feeInputs).map(i => i.value.trim()).filter(Boolean);

    // Collect links
    const linkLabels = linkFields.querySelectorAll('input[id^="mi-link-label-"]');
    const linkHrefs = linkFields.querySelectorAll('input[id^="mi-link-href-"]');
    const footerLinks = [];
    linkLabels.forEach((labelInput, i) => {
      const label = labelInput.value.trim();
      const href = linkHrefs[i]?.value.trim();
      if(label && href) footerLinks.push({ label, href });
    });

    const payload = {
      name,
      tagline,
      address,
      phone,
      hours,
      about: document.getElementById('mi-about').value.trim(),
      entranceFees,
      footerLinks
    };

    try{
      await Api.updateMuseumInfo(payload);
      toast('Museum information updated');
      closeModal();
      renderDashboard();
    }catch(err){
      errorEl.textContent = err.message;
    }
  });
}

// Add API method for museum info
if(!Api.getMuseumInfo){
  Api.getMuseumInfo = () => request('/api/museum-info');
}
if(!Api.updateMuseumInfo){
  Api.updateMuseumInfo = (payload) => request('/api/museum-info', { method: 'PUT', body: JSON.stringify(payload) });
}

// Global click handlers
document.addEventListener('click', (e) => {
  if (e.target.closest('#signOutBtn, #signOutBtnMobile, .admin-sidebar-signout')) {
    e.preventDefault();
    handleSignOut();
    return;
  }
  const tagBtn = e.target.closest('[data-tag]');
  if (tagBtn && tagBtn.dataset.tag) {
    e.preventDefault();
    openTagModal(tagBtn.dataset.tag);
    return;
  }
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn && tabBtn.dataset.tab) {
    e.preventDefault();
    activeTab = tabBtn.dataset.tab;
    if (window.MuseoSidebar) window.MuseoSidebar.close();
    renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
});

// Boot admin app
boot();
