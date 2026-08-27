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
}
function closeModal(){
  const el = document.getElementById('modalOverlay');
  if(el) el.remove();
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

async function boot(){

  if(!Api.getToken()){
    renderLogin();
    return;
  }
  try{
    await Api.me();
    renderDashboard();
  }catch(e){
    Api.clearToken();
    renderLogin();
  }
}

function renderLogin(){
  closeModal();
  if (window.MuseoSidebar) window.MuseoSidebar.close();
  document.body.classList.remove('sidebar-open');
  window.location.replace('/?tab=admin');
}

let activeTab = 'dashboard';

const SIDEBAR_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '📊' },
  { id: 'catalog',      label: 'Catalog',       icon: '🏛️' },
  { id: 'categories',   label: 'Categories',    icon: '🏷️' },
  { id: 'visitors',     label: 'Visitor Log',   icon: '📋' },
  { id: 'artifacts',    label: 'Artifacts Log', icon: '🏺' },
  { id: 'programs',     label: 'Programs',      icon: '🌱' },
  { id: 'events',       label: 'Events',        icon: '📅' },
  { id: 'gallery',      label: 'Gallery',       icon: '🖼️' },
  { id: 'analytics',    label: 'Analytics',     icon: '📈' },
  { id: 'feedback',     label: 'Feedback',      icon: '💬' },
  { id: 'museumInfo',   label: 'Museum Info',   icon: '🏛️' },
];

function handleSignOut() {
  Api.clearToken();
  if (window.MuseoSidebar) window.MuseoSidebar.close();
  document.body.classList.remove('sidebar-open');
  toast('Signed out successfully');
  renderLogin();
}

async function renderDashboard(){
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) toggleBtn.style.display = '';

  const activeItem = SIDEBAR_ITEMS.find(s => s.id === activeTab) || SIDEBAR_ITEMS[0];
  app.innerHTML = `
    <div class="admin-layout">
      <!-- Sidebar (Slide to Show) -->
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-sidebar-brand">
          <div class="admin-sidebar-logo">M</div>
          <div class="admin-sidebar-title">Admin<br><span>Dashboard</span></div>
          <button type="button" class="admin-sidebar-close" id="adminSidebarCloseBtn" aria-label="Close admin menu">✕</button>
        </div>
        <nav class="admin-sidebar-nav">
          ${SIDEBAR_ITEMS.map(item => `
            <button class="admin-sidebar-btn ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}">
              <span class="admin-sidebar-icon">${item.icon}</span>
              <span class="admin-sidebar-label">${item.label}</span>
              ${activeTab === item.id ? '<span class="admin-sidebar-indicator"></span>' : ''}
            </button>
          `).join('')}
        </nav>
        <div class="admin-sidebar-footer">
          <button class="admin-sidebar-signout" id="signOutBtn">
            <span>⎋</span> Sign out
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="admin-main">
        <header class="admin-topbar">
          <div class="admin-topbar-left">
            <div class="admin-topbar-icon">${activeItem.icon}</div>
            <div>
              <h1 class="admin-topbar-title">${activeItem.label}</h1>
              <p class="admin-topbar-sub">Manage ${activeItem.label.toLowerCase()} content</p>
            </div>
          </div>
        </header>
        <div id="tabContent" class="admin-content"></div>
      </div>
    </div>`;

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

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
    const recentVisitors = [...visitors].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    // Upcoming events (next 3)
    const now = new Date();
    const upcomingEvents = events
      .filter(e => e.date && new Date(e.date) >= now)
      .sort((a,b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);

    // Recent gallery
    const recentGallery = [...gallery].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);

    contentEl.innerHTML = `
      <div style="padding:16px 20px; display:flex; flex-direction:column; gap:16px;">
        <!-- Stats Overview -->
        <div class="kpi-cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon" style="width:28px; height:28px; font-size:14px;">🏛️</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${exhibits.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Total Exhibits</div>
            </div>
          </div>
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon green" style="width:28px; height:28px; font-size:14px;">🌱</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${programs.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Active Programs</div>
            </div>
          </div>
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon orange" style="width:28px; height:28px; font-size:14px;">📅</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${events.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Events</div>
            </div>
          </div>
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon purple" style="width:28px; height:28px; font-size:14px;">🖼️</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${gallery.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Gallery Items</div>
            </div>
          </div>
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon blue" style="width:28px; height:28px; font-size:14px;">👥</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${visitors.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Visitor Logs</div>
            </div>
          </div>
          <div class="kpi-stat-card" style="padding:10px 12px;">
            <div class="kpi-stat-icon" style="width:28px; height:28px; font-size:14px;">🏺</div>
            <div class="kpi-stat-info">
              <div class="kpi-stat-value" style="font-size:18px;">${artifacts.length}</div>
              <div class="kpi-stat-label" style="font-size:10px;">Artifacts</div>
            </div>
          </div>
        </div>

        <!-- Analytics Summary -->
        <div class="stat-cards" style="gap:8px;">
          <div class="stat-card" style="padding:10px 12px;"><div class="num" style="font-size:16px;">${totals.allTime}</div><div class="label" style="font-size:10px;">All-time Views</div></div>
          <div class="stat-card" style="padding:10px 12px;"><div class="num" style="font-size:16px;">${totals.last7Days}</div><div class="label" style="font-size:10px;">Last 7 Days</div></div>
          <div class="stat-card" style="padding:10px 12px;"><div class="num" style="font-size:16px;">${totals.last24Hours}</div><div class="label" style="font-size:10px;">Last 24 Hours</div></div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-top:8px;">
          <!-- Exhibits by Category -->
          <div class="info-card" style="padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 style="margin:0; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#ffffff; text-shadow:0 1px 3px rgba(0,0,0,0.5);">Exhibits by Category</h3>
              <a href="#" class="view-all-btn" data-tab="catalog">View All →</a>
            </div>
            ${Object.entries(categoryCounts).length ? `
              <ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px;">
                ${Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => `
                  <li style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; background:rgba(0,42,54,0.80); border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#ffffff;">
                    <span style="display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#ffffff;">
                      <span style="width:8px; height:8px; border-radius:50%; background:var(--teal); box-shadow:0 0 6px var(--teal);"></span>
                      ${escapeHtml(cat)}
                    </span>
                    <span style="font-weight:700; color:#ffffff; font-size:12px; background:rgba(0,174,189,0.28); border:1px solid rgba(0,174,189,0.4); padding:2px 8px; border-radius:999px;">${count}</span>
                  </li>
                `).join('')}
              </ul>
            ` : `<p style="color:#cbd5e1; font-size:12px; margin:4px 0 0;">No exhibits yet</p>`}
          </div>

          <!-- Recent Visitors -->
          <div class="info-card" style="padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 style="margin:0; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#ffffff; text-shadow:0 1px 3px rgba(0,0,0,0.5);">Recent Visitors</h3>
              <a href="#" class="view-all-btn" data-tab="visitors">View All →</a>
            </div>
            ${recentVisitors.length ? `
              <ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px;">
                ${recentVisitors.map(v => `
                  <li style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; background:rgba(0,42,54,0.80); border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#ffffff;">
                    <div>
                      <div style="font-weight:700; color:#ffffff; font-size:12.5px;">${escapeHtml(v.visitorName)}</div>
                      <div style="font-size:10.5px; color:#cbd5e1; margin-top:2px;">${escapeHtml(v.visitDate)} · ${v.pax || 1} pax</div>
                    </div>
                    <span class="status-badge ${(v.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}" style="font-size:9.5px; padding:2px 7px;">${escapeHtml(v.status || 'Checked-in')}</span>
                  </li>
                `).join('')}
              </ul>
            ` : `<p style="color:#cbd5e1; font-size:12px; margin:4px 0 0;">No visitors logged yet</p>`}
          </div>

          <!-- Upcoming Events -->
          <div class="info-card" style="padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 style="margin:0; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#ffffff; text-shadow:0 1px 3px rgba(0,0,0,0.5);">Upcoming Events</h3>
              <a href="#" class="view-all-btn" data-tab="events">View All →</a>
            </div>
            ${upcomingEvents.length ? `
              <ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:6px;">
                ${upcomingEvents.map(e => `
                  <li style="display:flex; flex-direction:column; gap:3px; padding:8px 12px; background:rgba(0,42,54,0.80); border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#ffffff;">
                    <div style="font-weight:700; color:#ffffff; font-size:12.5px;">${escapeHtml(e.title)}</div>
                    <div style="font-size:10.5px; color:#cbd5e1; display:flex; gap:10px; flex-wrap:wrap; margin-top:2px;">
                      <span>📅 ${escapeHtml(e.date)}</span>
                      <span>📍 ${escapeHtml(e.location || 'TBD')}</span>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : `<p style="color:#cbd5e1; font-size:12px; margin:4px 0 0;">No upcoming events</p>`}
          </div>

          <!-- Recent Gallery -->
          <div class="info-card" style="padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 style="margin:0; font-family:'Nunito',sans-serif; font-weight:800; font-size:15px; color:#ffffff; text-shadow:0 1px 3px rgba(0,0,0,0.5);">Recent Gallery</h3>
              <a href="#" class="view-all-btn" data-tab="gallery">View All →</a>
            </div>
            ${recentGallery.length ? `
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
                ${recentGallery.map(g => {
                  const paths = Array.isArray(g.imagePaths) && g.imagePaths.length ? g.imagePaths : (g.imagePath ? [g.imagePath] : []);
                  const img = paths[0] || '';
                  return `
                    <a href="#" data-tab="gallery" class="home-gallery-mini-item" style="border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.18);">
                      ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(g.title || 'Gallery')}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;">` : `<div style="width:100%; height:100%; background:rgba(0,42,54,0.85); display:flex; align-items:center; justify-content:center; font-size:24px;">🖼️</div>`}
                      <div class="home-gallery-mini-overlay">
                        <div class="home-gallery-mini-caption">${escapeHtml(g.title || g.caption || 'Museum snapshot')}</div>
                      </div>
                    </a>
                  `;
                }).join('')}
              </div>
            ` : `<p style="color:#cbd5e1; font-size:12px; margin:4px 0 0;">No gallery items yet</p>`}
          </div>
        </div>
      </div>
    `;
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load dashboard</h2><p>${escapeHtml(e.message)}</p></div>`;
  }
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
      <td class="title-cell" data-label="Title">${escapeHtml(ex.title)}</td>
      <td data-label="Category"><span class="cat-pill">${escapeHtml(ex.category)}</span></td>
      <td data-label="Rating" style="font-size:12.5px; color:var(--ink-soft);">${ex.ratingCount ? `★ ${ex.ratingAverage} (${ex.ratingCount})` : '—'}</td>
      <td data-label="Favorites" style="font-size:12.5px; color:var(--ink-soft);">${ex.favoriteCount || 0}</td>
      <td data-label="Location" style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(ex.location||'—')}</td>
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
  const exhibitUrl = `${window.location.origin}/exhibit.html?code=${encodeURIComponent(ex.code)}&src=scan`;

  openModal(`
    <div style="text-align: center; max-width: 480px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
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
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a class="btn btn-primary" href="${qrUrl}" download="Exhibit-${escapeHtml(ex.code)}-QR-Tag.png" style="flex: 1; min-width: 170px; text-align: center; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
            ⬇ Download PNG Tag
          </a>
          <button type="button" class="btn btn-ghost dark" id="printTagBtn" style="flex: 1; min-width: 130px; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
            🖨 Print Tag
          </button>
        </div>

        <div style="display: flex; gap: 6px; align-items: center; background: rgba(0, 42, 54, 0.85); border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; padding: 6px 10px;">
          <input type="text" readonly value="${escapeHtml(exhibitUrl)}" id="exhibitDirectUrl" style="flex: 1; background: transparent; border: none; color: #cbd5e1; font-family: monospace; font-size: 12px; padding: 4px; outline: none;">
          <button type="button" class="btn btn-secondary btn-small" id="copyUrlBtn" style="flex-shrink: 0;">Copy Link</button>
        </div>
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
        <button type="button" class="btn btn-ghost dark" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);

  document.getElementById('copyUrlBtn')?.addEventListener('click', () => {
    const input = document.getElementById('exhibitDirectUrl');
    if (input) {
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        toast('Direct scan link copied to clipboard!');
      });
    }
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

// ─── Exhibit Edit/Create Modal (with map coordinates) ───
function openEditModal(id, defaultCategory){
  const ex = id ? exhibitsCache.find(x=>x.id===id) : null;
  const isEdit = Boolean(ex);
  let pendingImagePaths = ex ? (Array.isArray(ex.imagePaths) ? [...ex.imagePaths] : (ex.imagePath ? [ex.imagePath] : [])) : [];
  let pendingMapImagePath = ex ? (ex.mapImagePath || '') : '';

  openModal(`
    <h2>${isEdit ? 'Edit exhibit' : 'Add exhibit'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title *</label><input type="text" id="ex-title" value="${ex?escapeHtml(ex.title):''}" placeholder="e.g. Giant Clam Shell" required></div>
      <div class="form-field"><label>Category *</label><select id="ex-category"><option value="">Select</option>${categoriesCache.map(c=>`<option value="${escapeHtml(c)}" ${ex && ex.category===c?'selected':''} ${defaultCategory && !ex && c===defaultCategory?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="form-field"><label>Origin</label><input type="text" id="ex-origin" value="${ex?escapeHtml(ex.origin):''}" placeholder="e.g. Philippines"></div>
      <div class="form-field"><label>Year</label><input type="text" id="ex-year" value="${ex?escapeHtml(ex.year):''}" placeholder="e.g. 2020"></div>
      <div class="form-field"><label>Location (display name + directions)</label><input type="text" id="ex-location" value="${ex?escapeHtml(ex.location):''}" placeholder="e.g. Gallery A, Shelf 3 — Right corner, 2nd floor near the windows"></div>
      <div class="form-field"><label>Latitude (map)</label><input type="number" step="0.000001" id="ex-lat" value="${ex && ex.lat !== null && ex.lat !== undefined ? ex.lat : ''}" placeholder="e.g. 10.945678"></div>
      <div class="form-field"><label>Longitude (map)</label><input type="number" step="0.000001" id="ex-lng" value="${ex && ex.lng !== null && ex.lng !== undefined ? ex.lng : ''}" placeholder="e.g. 123.421345"></div>
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
      <div class="form-field full">
        <label>Photos (multiple for swipeable album)</label>
        <input type="file" id="ex-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
        <div class="file-drop" id="ex-drop">Click or drop photos here (Ctrl/Cmd or Shift to select multiple)</div>
        <div class="file-hint">Tip: you can also hold Ctrl/Cmd or Shift to select multiple files.</div>
        <div class="image-preview-list" id="exImagePreviewList"></div>
        <div id="exUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full">
        <label>Video (optional — YouTube / Vimeo link or upload video)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="ex-video" value="${ex?escapeHtml(ex.videoUrl):''}" placeholder="e.g. https://www.youtube.com/watch?v=... or upload video">
          <button type="button" class="btn btn-ghost dark btn-small" id="ex-upload-video-btn">Upload video</button>
          <input type="file" id="ex-video-file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style="display:none;">
        </div>
        <div id="exVideoStatus" style="font-size:12px; color:var(--ink-soft); margin-top:4px;"></div>
      </div>
      <div class="form-error" id="exError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="exCancel">Cancel</button>
      <button class="btn btn-primary" id="exSave">${isEdit ? 'Save changes' : 'Add exhibit'}</button>
    </div>
  `);

  ensureMultipleInput('ex-image-file');
  renderImagePreviewList(ex ? (Array.isArray(ex.imagePaths) ? [...ex.imagePaths] : (ex.imagePath ? [ex.imagePath] : [])) : [], 'exImagePreviewList');

  const exVideoBtn = document.getElementById('ex-upload-video-btn');
  const exVideoFile = document.getElementById('ex-video-file');
  const exVideoInput = document.getElementById('ex-video');
  const exVideoStatus = document.getElementById('exVideoStatus');
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
      }catch(err){ exVideoStatus.textContent = 'Upload failed: ' + err.message; }
    });
  }

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
      lat: latNum,
      lng: lngNum,
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

// ---------------- Visitor Log ----------------
let visitorsCache = [];
let visitorStatsCache = null;
let adminVisitorsSearch = '';
let adminVisitorsGroupFilter = 'All';
let adminVisitorsStatusFilter = 'All';
let adminVisitorsDateFilter = '';

async function renderVisitorsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading visitor logs…</p></div>`;
  try{
    const [visRes, statsRes] = await Promise.all([
      Api.listVisitors(),
      Api.getVisitorStats().catch(()=>({ stats: {} }))
    ]);
    visitorsCache = (visRes && Array.isArray(visRes.visitors)) ? visRes.visitors : [];
    visitorStatsCache = (statsRes && statsRes.stats) ? statsRes.stats : {};
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load visitor logs</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const stats = visitorStatsCache || {};
  const totalVisits = stats.totalVisits != null ? stats.totalVisits : visitorsCache.length;
  const totalPax = stats.totalPax != null ? stats.totalPax : 0;
  const todayVisits = stats.todayVisits != null ? stats.todayVisits : 0;
  const todayPax = stats.todayPax != null ? stats.todayPax : 0;
  const scheduledCount = (stats.byStatus && stats.byStatus['Scheduled']) || 0;
  const checkedInCount = (stats.byStatus && stats.byStatus['Checked-in']) || 0;

  let filtered = [...visitorsCache];
  if(adminVisitorsSearch){
    const q = adminVisitorsSearch.toLowerCase();
    filtered = filtered.filter(v =>
      (v.visitorName || '').toLowerCase().includes(q) ||
      (v.groupName || '').toLowerCase().includes(q) ||
      (v.contactNumber || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.purpose || '').toLowerCase().includes(q) ||
      (v.tourGuide || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q)
    );
  }
  if(adminVisitorsGroupFilter !== 'All'){
    filtered = filtered.filter(v => (v.groupType || '').toLowerCase() === adminVisitorsGroupFilter.toLowerCase());
  }
  if(adminVisitorsStatusFilter !== 'All'){
    filtered = filtered.filter(v => (v.status || '').toLowerCase() === adminVisitorsStatusFilter.toLowerCase());
  }
  if(adminVisitorsDateFilter){
    filtered = filtered.filter(v => (v.visitDate || '').startsWith(adminVisitorsDateFilter));
  }

  contentEl.innerHTML = `
    <div class="kpi-cards-grid">
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon">📋</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${totalVisits}</div>
          <div class="kpi-stat-label">Total Visits Logged</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon orange">👥</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${totalPax}</div>
          <div class="kpi-stat-label">Total Visitors (Pax)</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon green">📅</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${todayVisits}</div>
          <div class="kpi-stat-label">Today's Visits (${todayPax} pax)</div>
        </div>
      </div>
      <div class="kpi-stat-card">
        <div class="kpi-stat-icon purple">⏳</div>
        <div class="kpi-stat-info">
          <div class="kpi-stat-value">${checkedInCount + scheduledCount}</div>
          <div class="kpi-stat-label">${checkedInCount} Checked-in · ${scheduledCount} Scheduled</div>
        </div>
      </div>
    </div>

<div class="admin-toolbar-wrap">
      <div class="admin-toolbar-row">
        <input type="text" id="adminVisitorsSearchInput" class="admin-search-input" placeholder="Search visitors by name, group, school, phone, guide…" value="${escapeHtml(adminVisitorsSearch)}">
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-export" id="exportVisitorsBtn" title="Export current visitor list as CSV">📥 Export CSV</button>
          <button class="btn btn-primary btn-small" id="addVisitorBtn">+ Log visitor entry</button>
          <button class="btn btn-primary btn-small" id="visitorCheckinQrBtn">📱 Check-in QR</button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="adminVisitorsGroupSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--grey-200);">
            <option value="All" ${adminVisitorsGroupFilter==='All'?'selected':''}>All Group Types</option>
            <option value="Walk-in / Individual" ${adminVisitorsGroupFilter==='Walk-in / Individual'?'selected':''}>Walk-in / Individual</option>
            <option value="School Tour" ${adminVisitorsGroupFilter==='School Tour'?'selected':''}>School Tour</option>
            <option value="Family" ${adminVisitorsGroupFilter==='Family'?'selected':''}>Family</option>
            <option value="Government / VIP" ${adminVisitorsGroupFilter==='Government / VIP'?'selected':''}>Government / VIP</option>
            <option value="NGO / Community" ${adminVisitorsGroupFilter==='NGO / Community'?'selected':''}>NGO / Community</option>
            <option value="Researcher / Scholar" ${adminVisitorsGroupFilter==='Researcher / Scholar'?'selected':''}>Researcher / Scholar</option>
            <option value="Other" ${adminVisitorsGroupFilter==='Other'?'selected':''}>Other</option>
          </select>
          <select id="adminVisitorsStatusSelect" class="filter-select" style="padding:6px 12px; font-size:12.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,42,54,0.85); color:#ffffff;">
            <option value="All" ${adminVisitorsStatusFilter==='All'?'selected':''}>All Statuses</option>
            <option value="Checked-in" ${adminVisitorsStatusFilter==='Checked-in'?'selected':''}>Checked-in</option>
            <option value="Completed" ${adminVisitorsStatusFilter==='Completed'?'selected':''}>Completed</option>
            <option value="Scheduled" ${adminVisitorsStatusFilter==='Scheduled'?'selected':''}>Scheduled</option>
            <option value="Cancelled" ${adminVisitorsStatusFilter==='Cancelled'?'selected':''}>Cancelled</option>
          </select>
          <input type="date" id="adminVisitorsDateInput" value="${escapeHtml(adminVisitorsDateFilter)}" title="Filter by visit date" style="padding:5px 10px; font-size:12.5px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,42,54,0.85); color:#ffffff;">
          ${(adminVisitorsSearch || adminVisitorsGroupFilter !== 'All' || adminVisitorsStatusFilter !== 'All' || adminVisitorsDateFilter) ? '<button type="button" class="btn btn-ghost dark btn-small" id="clearVisitorsFilters" style="padding:4px 8px; font-size:11.5px; color:#5eead4; border-color:rgba(0,174,189,0.4);">Reset filters</button>' : ''}
        </div>
        <span style="font-size:13px; color:#cbd5e1; font-weight:600;">${filtered.length} of ${visitorsCache.length} records</span>
      </div>
    </div>

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
            <th>Status</th>
            <th>Address</th>
            <th>Sex</th>
            <th>Age</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="visitorsTableBody"></tbody>
      </table>
    </div>
    ${filtered.length === 0 ? `<div class="empty-state"><h2 style="color:#ffffff;">No visitor records found</h2><p style="color:#cbd5e1;">No visitor logs match your search and filter criteria.</p></div>` : ''}
  `;

  // Bind Events
  const searchInput = document.getElementById('adminVisitorsSearchInput');
  if(searchInput){
    searchInput.addEventListener('input', (e)=>{
      adminVisitorsSearch = e.target.value.trim();
      renderVisitorsTab(contentEl);
      const updated = document.getElementById('adminVisitorsSearchInput');
      if(updated){ updated.focus(); updated.setSelectionRange(updated.value.length, updated.value.length); }
    });
  }

  document.getElementById('adminVisitorsGroupSelect')?.addEventListener('change', (e)=>{
    adminVisitorsGroupFilter = e.target.value;
    renderVisitorsTab(contentEl);
  });
  document.getElementById('adminVisitorsStatusSelect')?.addEventListener('change', (e)=>{
    adminVisitorsStatusFilter = e.target.value;
    renderVisitorsTab(contentEl);
  });
  document.getElementById('adminVisitorsDateInput')?.addEventListener('change', (e)=>{
    adminVisitorsDateFilter = e.target.value;
    renderVisitorsTab(contentEl);
  });
  document.getElementById('clearVisitorsFilters')?.addEventListener('click', ()=>{
    adminVisitorsSearch = '';
    adminVisitorsGroupFilter = 'All';
    adminVisitorsStatusFilter = 'All';
    adminVisitorsDateFilter = '';
    renderVisitorsTab(contentEl);
  });
  document.getElementById('exportVisitorsBtn')?.addEventListener('click', ()=>exportVisitorsCSV(filtered));
  document.getElementById('addVisitorBtn')?.addEventListener('click', ()=>openVisitorModal(null));
  document.getElementById('visitorCheckinQrBtn')?.addEventListener('click', ()=>openVisitorCheckinQrModal());

  const tbody = document.getElementById('visitorsTableBody');
  if(tbody){
    tbody.innerHTML = filtered.map(v => {
      const statusClass = (v.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const contactInfo = [v.contactNumber, v.email].filter(Boolean).join(' · ');
      return `
        <tr>
          <td data-label="Date & Time" style="white-space:nowrap;">
            <div style="font-weight:800; color:#ffffff; font-size:13.5px; text-shadow:0 1px 2px rgba(0,0,0,0.5);">${escapeHtml(v.visitDate || '—')}</div>
            <div style="font-size:11.5px; color:#cbd5e1; font-weight:600;">${escapeHtml(v.visitTime || '')}</div>
          </td>
          <td data-label="Visitor / Contact">
            <div style="font-weight:800; color:#ffffff; font-size:14.5px; text-shadow:0 1px 2px rgba(0,0,0,0.5);">${escapeHtml(v.visitorName)}</div>
            ${contactInfo ? `<div style="font-size:11.5px; color:#cbd5e1; margin-top:2px;">${escapeHtml(contactInfo)}</div>` : ''}
          </td>
          <td data-label="Group / Organization">
            ${v.groupName ? `<div style="font-weight:700; color:#ffffff; font-size:14px; text-shadow:0 1px 2px rgba(0,0,0,0.5); margin-bottom:4px;">${escapeHtml(v.groupName)}</div>` : ''}
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
          <td data-label="Status">
            <span class="status-badge ${statusClass}">${escapeHtml(v.status || 'Checked-in')}</span>
          </td>
          <td data-label="Address" style="font-size:12.5px; color:#f1f5f9; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(v.address || '—')}">${escapeHtml(v.address || '—')}</td>
          <td data-label="Sex" style="font-size:12.5px; color:#f1f5f9;">${escapeHtml(v.sex || '—')}</td>
          <td data-label="Age" style="font-size:12.5px; color:#f1f5f9; text-align:center; font-weight:700;">${v.age !== null && v.age !== undefined ? v.age : '—'}</td>
          <td data-label="Actions" style="text-align:right; white-space:nowrap;">
            <button class="btn btn-danger btn-small" data-del-visitor="${v.id}" title="Delete entry">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

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

function exportVisitorsCSV(list){
  const headers = ['Date', 'Time', 'Visitor / Contact Person', 'Group / Organization', 'Group Type', 'Pax', 'Purpose', 'Tour Guide', 'Status', 'Phone', 'Email', 'Address', 'Sex', 'Age', 'Notes'];
  const rows = list.map(v => [
    `"${(v.visitDate || '').replace(/"/g, '""')}"`,
    `"${(v.visitTime || '').replace(/"/g, '""')}"`,
    `"${(v.visitorName || '').replace(/"/g, '""')}"`,
    `"${(v.groupName || '').replace(/"/g, '""')}"`,
    `"${(v.groupType || '').replace(/"/g, '""')}"`,
    v.pax || 1,
    `"${(v.purpose || '').replace(/"/g, '""')}"`,
    `"${(v.tourGuide || '').replace(/"/g, '""')}"`,
    `"${(v.status || '').replace(/"/g, '""')}"`,
    `"${(v.contactNumber || '').replace(/"/g, '""')}"`,
    `"${(v.email || '').replace(/"/g, '""')}"`,
    `"${(v.address || '').replace(/"/g, '""')}"`,
    `"${(v.sex || '').replace(/"/g, '""')}"`,
    v.age !== null && v.age !== undefined ? v.age : '',
    `"${(v.notes || '').replace(/"/g, '""')}"`
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `msbn-visitors-log-${dateStr}.csv`);
  toast('Visitor log CSV exported');
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

function openVisitorModal(v){
  const isEdit = Boolean(v);
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);

  openModal(`
    <h2>${isEdit ? 'Edit visitor log' : 'Log new visitor entry'}</h2>
    <div class="form-grid">
      <div class="form-field full">
        <label>Visitor / Contact Person Name *</label>
        <input type="text" id="vf-name" value="${v ? escapeHtml(v.visitorName) : ''}" placeholder="e.g. Maria Santos">
      </div>
      <div class="form-field full">
        <label>Address *</label>
        <textarea id="vf-address" placeholder="Enter complete address">${v ? escapeHtml(v.address || '') : ''}</textarea>
      </div>
      <div class="form-field">
        <label>Sex *</label>
        <select id="vf-sex">
          <option value="">Select</option>
          <option value="Male" ${v && v.sex==='Male'?'selected':''}>Male</option>
          <option value="Female" ${v && v.sex==='Female'?'selected':''}>Female</option>
          <option value="Other" ${v && v.sex==='Other'?'selected':''}>Other</option>
          <option value="Prefer not to say" ${v && v.sex==='Prefer not to say'?'selected':''}>Prefer not to say</option>
        </select>
      </div>
      <div class="form-field">
        <label>Age *</label>
        <input type="number" id="vf-age" min="0" max="120" value="${v && v.age !== null && v.age !== undefined ? v.age : ''}" placeholder="e.g. 25">
      </div>
      <div class="form-field">
        <label>Group / School / Org Name (optional)</label>
        <input type="text" id="vf-group" value="${v ? escapeHtml(v.groupName) : ''}" placeholder="e.g. Sagay National High School">
      </div>
      <div class="form-field">
        <label>Group Type</label>
        <select id="vf-groupType">
          <option value="Walk-in / Individual" ${(!v || v.groupType==='Walk-in / Individual')?'selected':''}>Walk-in / Individual</option>
          <option value="School Tour" ${v && v.groupType==='School Tour'?'selected':''}>School Tour</option>
          <option value="Family" ${v && v.groupType==='Family'?'selected':''}>Family</option>
          <option value="Government / VIP" ${v && v.groupType==='Government / VIP'?'selected':''}>Government / VIP</option>
          <option value="NGO / Community" ${v && v.groupType==='NGO / Community'?'selected':''}>NGO / Community</option>
          <option value="Researcher / Scholar" ${v && v.groupType==='Researcher / Scholar'?'selected':''}>Researcher / Scholar</option>
          <option value="Other" ${v && v.groupType==='Other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-field">
        <label>Headcount (Pax) *</label>
        <input type="number" id="vf-pax" min="1" value="${v ? (v.pax || 1) : 1}">
      </div>
      <div class="form-field">
        <label>Purpose of Visit</label>
        <select id="vf-purpose">
          <option value="General Visit" ${(!v || v.purpose==='General Visit')?'selected':''}>General Visit</option>
          <option value="Educational Tour" ${v && v.purpose==='Educational Tour'?'selected':''}>Educational Tour</option>
          <option value="Research" ${v && v.purpose==='Research'?'selected':''}>Research</option>
          <option value="Special Event" ${v && v.purpose==='Special Event'?'selected':''}>Special Event</option>
          <option value="Donation / Official" ${v && v.purpose==='Donation / Official'?'selected':''}>Donation / Official</option>
          <option value="Other" ${v && v.purpose==='Other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-field">
        <label>Visit Date</label>
        <input type="date" id="vf-date" value="${v ? escapeHtml(v.visitDate) : defaultDate}">
      </div>
      <div class="form-field">
        <label>Visit Time</label>
        <input type="time" id="vf-time" value="${v ? escapeHtml(v.visitTime) : defaultTime}">
      </div>
      <div class="form-field">
        <label>Assigned Tour Guide / Staff</label>
        <input type="text" id="vf-guide" value="${v ? escapeHtml(v.tourGuide) : ''}" placeholder="e.g. Juan De La Cruz">
      </div>
      <div class="form-field">
        <label>Status</label>
        <select id="vf-status">
          <option value="Checked-in" ${(!v || v.status==='Checked-in')?'selected':''}>Checked-in</option>
          <option value="Completed" ${v && v.status==='Completed'?'selected':''}>Completed</option>
          <option value="Scheduled" ${v && v.status==='Scheduled'?'selected':''}>Scheduled</option>
          <option value="Cancelled" ${v && v.status==='Cancelled'?'selected':''}>Cancelled</option>
        </select>
      </div>
      <div class="form-field">
        <label>Contact Phone / Mobile</label>
        <input type="text" id="vf-phone" value="${v ? escapeHtml(v.contactNumber) : ''}" placeholder="e.g. +63 917 123 4567">
      </div>
      <div class="form-field">
        <label>Email Address</label>
        <input type="email" id="vf-email" value="${v ? escapeHtml(v.email) : ''}" placeholder="e.g. visitor@example.com">
      </div>
      <div class="form-field full">
        <label>Notes / Special Requirements / Accommodations</label>
        <textarea id="vf-notes" rows="2" placeholder="Special accommodations, feedback, or reminders...">${v ? escapeHtml(v.notes) : ''}</textarea>
      </div>
      <div class="form-error" id="vfError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="vfCancel">Cancel</button>
      <button class="btn btn-primary" id="vfSave">${isEdit ? 'Save changes' : 'Log visitor'}</button>
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
      status: document.getElementById('vf-status').value,
      contactNumber: document.getElementById('vf-phone').value.trim(),
      email: document.getElementById('vf-email').value.trim(),
      notes: document.getElementById('vf-notes').value.trim()
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try{
      if(isEdit){
        await Api.updateVisitor(v.id, payload);
        toast('Visitor log updated');
      } else {
        await Api.createVisitor(payload);
        toast('Visitor entry logged');
      }
      closeModal();
      renderDashboard();
    }catch(err){
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save changes' : 'Log visitor';
    }
  });
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
        <h3 style="margin:0 0 12px; font-family:'Fraunces',serif; font-size:16px;">Basic Information</h3>
        <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escapeHtml(info.name || '—')}</span></div>
        <div class="info-row"><span class="info-label">Tagline</span><span class="info-value">${escapeHtml(info.tagline || '—')}</span></div>
        <div class="info-row"><span class="info-label">Address</span><span class="info-value">${escapeHtml(info.address || '—')}</span></div>
        <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${escapeHtml(info.phone || '—')}</span></div>
        <div class="info-row"><span class="info-label">Hours</span><span class="info-value">${escapeHtml(info.hours || '—')}</span></div>
      </div>

      <div class="info-card">
        <h3 style="margin:0 0 12px; font-family:'Fraunces',serif; font-size:16px;">About</h3>
        <div class="info-value" style="white-space:pre-wrap; font-weight:400;">${escapeHtml(info.about || '—')}</div>
      </div>

      <div class="info-card">
        <h3 style="margin:0 0 12px; font-family:'Fraunces',serif; font-size:16px;">Entrance Fees</h3>
        <ul style="margin:0; padding-left:20px;">
          ${(info.entranceFees || []).map(f => `<li style="margin:6px 0;">${escapeHtml(f)}</li>`).join('')}
        </ul>
      </div>

      <div class="info-card">
        <h3 style="margin:0 0 12px; font-family:'Fraunces',serif; font-size:16px;">Footer Links</h3>
        <ul style="margin:0; padding-left:20px;">
          ${(info.footerLinks || []).map(f => `<li style="margin:6px 0;"><strong>${escapeHtml(f.label)}</strong> → ${escapeHtml(f.href)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <style>
      .info-card { background:var(--white); border:1px solid var(--grey-100); border-radius:12px; padding:20px; }
      .info-row { display:flex; gap:16px; padding:8px 0; border-bottom:1px solid var(--grey-100); align-items:flex-start; }
      .info-row:last-child { border-bottom:none; }
      .info-label { font-weight:700; color:var(--ink-soft); min-width:120px; font-size:13px; }
      .info-value { color:var(--ink); flex:1; font-size:13px; line-height:1.5; }
    </style>
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
  }
  const tagBtn = e.target.closest('[data-tag]');
  if (tagBtn && tagBtn.dataset.tag) {
    e.preventDefault();
    openTagModal(tagBtn.dataset.tag);
  }
});

// Boot admin app
boot();
