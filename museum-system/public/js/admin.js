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
  app.innerHTML = `
    <div class="gate">
      <h2>Staff sign-in</h2>
      <p>Enter your admin credentials to manage exhibits.</p>
      <div class="error" id="loginError"></div>
      <input type="text" id="loginUser" placeholder="Username" autocomplete="username">
      <input type="password" id="loginPass" placeholder="Password" autocomplete="current-password">
      <button class="btn btn-primary" style="width:100%; justify-content:center;" id="loginSubmit">Sign in</button>
      <div class="hint">First time? Run <span class="mono">npm run seed</span> on the server to create the initial admin account.</div>
    </div>`;

  const submit = async ()=>{
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';
    if(!username || !password){ errorEl.textContent = 'Enter a username and password.'; return; }
    const btn = document.getElementById('loginSubmit');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try{
      const { token } = await Api.login(username, password);
      Api.setToken(token);
      renderDashboard();
    }catch(e){
      errorEl.textContent = e.message;
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };
  document.getElementById('loginSubmit').addEventListener('click', submit);
  document.getElementById('loginPass').addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
}

let activeTab = 'catalog';

async function renderDashboard(){
  app.innerHTML = `
    <div class="admin-panel">
      <div class="admin-head">
        <h2>Admin dashboard</h2>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost dark btn-small" id="signOutBtn">Sign out</button>
        </div>
      </div>
      <div class="admin-tabs">
        <button class="admin-tab ${activeTab==='catalog'?'active':''}" data-tab="catalog">Catalog</button>
        <button class="admin-tab ${activeTab==='programs'?'active':''}" data-tab="programs">Programs</button>
        <button class="admin-tab ${activeTab==='events'?'active':''}" data-tab="events">Events</button>
        <button class="admin-tab ${activeTab==='gallery'?'active':''}" data-tab="gallery">Gallery</button>
        <button class="admin-tab ${activeTab==='analytics'?'active':''}" data-tab="analytics">Analytics</button>
        <button class="admin-tab ${activeTab==='feedback'?'active':''}" data-tab="feedback">Feedback</button>
      </div>
      <div id="tabContent"></div>
    </div>`;

  document.getElementById('signOutBtn').addEventListener('click', ()=>{ Api.clearToken(); renderLogin(); });
  app.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeTab = btn.dataset.tab; renderDashboard(); });
  });

  const contentEl = document.getElementById('tabContent');
  if(activeTab === 'catalog') await renderCatalogTab(contentEl);
  else if(activeTab === 'programs') await renderProgramsTab(contentEl);
  else if(activeTab === 'events') await renderEventsTab(contentEl);
  else if(activeTab === 'gallery') await renderGalleryTab(contentEl);
  else if(activeTab === 'analytics') await renderAnalyticsTab(contentEl);
  else await renderFeedbackTab(contentEl);
}

async function renderCatalogTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading catalog…</p></div>`;
  try{
    const { exhibits } = await Api.listExhibits();
    exhibitsCache = exhibits;
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load exhibits</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  contentEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 26px 0;">
      <span style="font-size:13px; color:var(--ink-soft);">${exhibitsCache.length} entries</span>
      <button class="btn btn-primary btn-small" id="addExhibitBtn">+ Add exhibit</button>
    </div>
    <div class="admin-table-wrap">
      <table class="ledger">
        <thead><tr><th>Tag</th><th>Code</th><th>Title</th><th>Category</th><th>Rating</th><th>♥</th><th>Location</th><th></th></tr></thead>
        <tbody id="ledgerBody"></tbody>
      </table>
    </div>
    ${exhibitsCache.length===0 ? `<div class="empty-state"><h2>No exhibits catalogued</h2><p>Add your first exhibit to generate its QR tag.</p></div>` : ''}
  `;

  const tbody = document.getElementById('ledgerBody');
  tbody.innerHTML = exhibitsCache.map(ex => `
    <tr>
      <td><div class="thumb">${ex.optimizedImagePath || ex.imagePath ? `<a href="${escapeHtml(ex.optimizedImagePath || ex.imagePath)}" target="_blank" rel="noopener">`+
          `<img class="img-enhance" src="${escapeHtml(ex.optimizedImagePath || ex.imagePath)}" onerror="this.parentElement.innerHTML='${CATEGORY_ICON[ex.category]||CATEGORY_ICON.Other}'">`+
        `</a>` : (CATEGORY_ICON[ex.category]||CATEGORY_ICON.Other)}</div></td>
      <td class="id-cell">${ex.code}</td>
      <td class="title-cell">${escapeHtml(ex.title)}</td>
      <td><span class="cat-pill">${escapeHtml(ex.category)}</span></td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${ex.ratingCount ? `★ ${ex.ratingAverage} (${ex.ratingCount})` : '—'}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${ex.favoriteCount || 0}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(ex.location||'—')}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost dark btn-small" data-edit="${ex.id}">Edit</button>
          <button class="btn btn-ghost dark btn-small" data-tag="${ex.code}">Tag</button>
          <button class="btn btn-danger btn-small" data-delete="${ex.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('addExhibitBtn').addEventListener('click', ()=>openEditModal(null));
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openEditModal(b.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click', ()=>confirmDelete(b.dataset.delete)));
  tbody.querySelectorAll('[data-tag]').forEach(b=>b.addEventListener('click', ()=>openTagModal(b.dataset.tag)));
}

async function renderAnalyticsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading analytics…</p></div>`;
  let data;
  try{
    data = await Api.adminAnalytics();
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
    <div style="padding:0 26px 8px;"><h3 style="font-family:'Fraunces',serif; font-size:16px; margin:0 0 10px;">Most viewed exhibits</h3></div>
    <div class="admin-table-wrap">
      <table class="ledger">
        <thead><tr><th>Exhibit</th><th>Code</th><th>Scans (QR)</th><th>Other views</th><th>Total</th></tr></thead>
        <tbody>
          ${byExhibit.length ? byExhibit.map(row => `
            <tr>
              <td class="title-cell">${escapeHtml(row.title)}</td>
              <td class="id-cell">${row.code || '—'}</td>
              <td>${row.scans}</td>
              <td>${row.views}</td>
              <td><b>${row.total}</b></td>
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
              <td style="font-size:12px; color:var(--ink-soft);">${new Date(ev.at).toLocaleString()}</td>
              <td class="title-cell">${escapeHtml(ev.title)}</td>
              <td><span class="cat-pill">${ev.source === 'scan' ? 'QR scan' : 'Direct view'}</span></td>
            </tr>
          `).join('') : `<tr><td colspan="3" style="text-align:center; color:var(--ink-soft); padding:24px;">Nothing yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function renderFeedbackTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading feedback…</p></div>`;
  let ratings;
  try{
    const res = await Api.adminRatings();
    ratings = res.ratings;
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load feedback</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }

  if(ratings.length === 0){
    contentEl.innerHTML = `<div class="empty-state"><h2>No feedback yet</h2><p>Visitor ratings and comments will show up here.</p></div>`;
    return;
  }

  contentEl.innerHTML = `
    <div style="padding:16px 26px 0; font-size:13px; color:var(--ink-soft);">${ratings.length} rating${ratings.length===1?'':'s'} submitted</div>
    <div style="padding:14px 26px 26px; display:flex; flex-direction:column; gap:12px;" id="feedbackList"></div>
  `;
  const list = document.getElementById('feedbackList');
  list.innerHTML = ratings.map(r => `
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

function confirmDelete(id){
  const ex = exhibitsCache.find(e=>e.id===id);
  if(!ex) return;
  openModal(`
    <h2>Delete "${escapeHtml(ex.title)}"?</h2>
    <p style="font-size:13.5px; color:var(--ink-soft); margin:-8px 0 4px;">This removes the exhibit and retires its QR tag. This can't be undone.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="cancelDel">Cancel</button>
      <button class="btn btn-danger" id="confirmDel">Delete exhibit</button>
    </div>`);
  document.getElementById('cancelDel').addEventListener('click', closeModal);
  document.getElementById('confirmDel').addEventListener('click', async ()=>{
    try{
      await Api.deleteExhibit(id);
      closeModal();
      toast('Exhibit deleted');
      renderDashboard();
    }catch(e){ toast(e.message, true); }
  });
}

function openTagModal(code){
  openModal(`
    <h2>Exhibit tag — ${code}</h2>
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
      <div style="background:#fff; padding:14px; border-radius:10px;">
        <img src="${Api.qrUrl(code)}" alt="QR tag" width="200" height="200">
      </div>
      <div style="font-size:12px; color:var(--ink-soft); text-align:center; max-width:36ch;">Print this tag and place it beside the exhibit. Scanning it opens this exhibit's public label directly.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="closeTagModal">Close</button>
      <a class="btn btn-primary" href="${Api.qrUrl(code)}" download="${code}-tag.png">Download PNG</a>
    </div>`);
  document.getElementById('closeTagModal').addEventListener('click', closeModal);
}

function openEditModal(id){
  const ex = id ? exhibitsCache.find(e=>e.id===id) : null;
  let pendingImagePaths = ex ? (Array.isArray(ex.imagePaths) ? [...ex.imagePaths] : (ex.imagePath ? [ex.imagePath] : [])) : [];

  openModal(`
    <h2>${ex ? 'Edit exhibit' : 'Add exhibit'}</h2>
    <div class="form-grid" id="formGrid">
      <div class="form-field full">
        <label>Title</label>
        <input type="text" id="f-title" value="${ex ? escapeHtml(ex.title) : ''}" placeholder="e.g. The Voyager's Astrolabe">
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="f-category">
          ${CATEGORIES.map(c=>`<option value="${c}" ${ex && ex.category===c ? 'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Date / era</label>
        <input type="text" id="f-year" value="${ex ? escapeHtml(ex.year) : ''}" placeholder="e.g. c. 1580">
      </div>
      <div class="form-field">
        <label>Origin</label>
        <input type="text" id="f-origin" value="${ex ? escapeHtml(ex.origin) : ''}" placeholder="e.g. Ottoman Empire">
      </div>
      <div class="form-field">
        <label>Gallery location</label>
        <input type="text" id="f-location" value="${ex ? escapeHtml(ex.location) : ''}" placeholder="e.g. Hall 1 — Navigation Wing">
      </div>
      <div class="form-field full">
        <label>Photos</label>
          <input type="file" id="f-image-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple="multiple" style="display:none;">
          <div class="file-drop" id="f-drop">Click or drop photos here (Ctrl/Cmd or Shift to select multiple)</div>
          <div class="file-hint">Tip: you can also hold Ctrl/Cmd or Shift to select multiple files.</div>
          <div class="image-preview-list" id="imagePreviewList"></div>
          <div id="uploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full">
        <label>Description</label>
        <textarea id="f-desc" placeholder="Notes shown on the visitor exhibit page…">${ex ? escapeHtml(ex.description) : ''}</textarea>
      </div>
      <div class="form-error" id="formError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="cancelEdit">Cancel</button>
      <button class="btn btn-primary" id="saveEdit">${ex ? 'Save changes' : 'Add exhibit'}</button>
    </div>`);

  ensureMultipleInput('f-image-file');
  renderImagePreviewList(pendingImagePaths, 'imagePreviewList');
    const fInput = document.getElementById('f-image-file');
    const fDrop = document.getElementById('f-drop');
  if(fDrop){
    fDrop.addEventListener('click', ()=>fInput.click());
    fDrop.addEventListener('dragover', (ev)=>{ ev.preventDefault(); fDrop.classList.add('dragover'); });
    fDrop.addEventListener('dragleave', ()=>fDrop.classList.remove('dragover'));
    fDrop.addEventListener('drop', async (ev)=>{
      ev.preventDefault(); fDrop.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if(files.length === 0) return;
      const status = document.getElementById('uploadStatus');
      status.textContent = 'Uploading…';
      try{
        for(const file of files){
          const { path } = await Api.uploadImage(file);
          pendingImagePaths.push(path);
        }
        renderImagePreviewList(pendingImagePaths, 'imagePreviewList');
        status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
    });
  }
  fInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(files.length === 0) return;
    const status = document.getElementById('uploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        pendingImagePaths.push(path);
      }
      renderImagePreviewList(pendingImagePaths, 'imagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} uploaded.`;
      e.target.value = '';
    }catch(err){
      status.textContent = 'Upload failed: ' + err.message;
    }
  });

  document.getElementById('cancelEdit').addEventListener('click', closeModal);
  document.getElementById('saveEdit').addEventListener('click', async ()=>{
    const title = document.getElementById('f-title').value.trim();
    const errorEl = document.getElementById('formError');
    errorEl.textContent = '';
    if(!title){ errorEl.textContent = 'Title is required.'; return; }
    const payload = {
      title,
      category: document.getElementById('f-category').value,
      year: document.getElementById('f-year').value.trim(),
      origin: document.getElementById('f-origin').value.trim(),
      location: document.getElementById('f-location').value.trim(),
      imagePaths: pendingImagePaths,
      description: document.getElementById('f-desc').value.trim()
    };
    const btn = document.getElementById('saveEdit');
    btn.disabled = true;
    try{
      if(ex){
        await Api.updateExhibit(ex.id, payload);
        toast('Exhibit updated');
      } else {
        await Api.createExhibit(payload);
        toast('Exhibit added — QR tag generated');
      }
      closeModal();
      renderDashboard();
    }catch(err){
      errorEl.textContent = err.message;
      btn.disabled = false;
    }
  });
}

// ---------------- Programs ----------------
let programsCache = [];

async function renderProgramsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading programs…</p></div>`;
  try{
    const { programs } = await Api.listPrograms();
    programsCache = programs;
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load programs</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }
  contentEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 26px 0;">
      <span style="font-size:13px; color:var(--ink-soft);">${programsCache.length} programs</span>
      <button class="btn btn-primary btn-small" id="addProgramBtn">+ Add program</button>
    </div>
    <div class="admin-table-wrap">
      <table class="ledger">
        <thead><tr><th>Title</th><th>Ages</th><th>Schedule</th><th></th></tr></thead>
        <tbody id="programsBody"></tbody>
      </table>
    </div>
    ${programsCache.length===0 ? `<div class="empty-state"><h2>No programs yet</h2><p>Add the museum's first program.</p></div>` : ''}
  `;
  document.getElementById('addProgramBtn').addEventListener('click', ()=>openProgramModal(null));
  const tbody = document.getElementById('programsBody');
  tbody.innerHTML = programsCache.map(p => `
    <tr>
      <td class="title-cell">${escapeHtml(p.title)}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(p.ageRange||'—')}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(p.schedule||'—')}</td>
      <td><div class="row-actions">
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
  openModal(`
    <h2>${p ? 'Edit program' : 'Add program'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title</label><input type="text" id="pf-title" value="${p?escapeHtml(p.title):''}" placeholder="e.g. Junior Museum Guide Program"></div>
      <div class="form-field"><label>Age range</label><input type="text" id="pf-age" value="${p?escapeHtml(p.ageRange):''}" placeholder="e.g. 7–12"></div>
      <div class="form-field"><label>Schedule</label><input type="text" id="pf-schedule" value="${p?escapeHtml(p.schedule):''}" placeholder="e.g. Ongoing cohorts"></div>
      <div class="form-field full">
        <label>Photos</label>
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

async function renderEventsTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading events…</p></div>`;
  try{
    const { events } = await Api.listEvents();
    eventsCache = events;
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load events</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }
  contentEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 26px 0;">
      <span style="font-size:13px; color:var(--ink-soft);">${eventsCache.length} events</span>
      <button class="btn btn-primary btn-small" id="addEventBtn">+ Add event</button>
    </div>
    <div class="admin-table-wrap">
      <table class="ledger">
        <thead><tr><th>Title</th><th>Date</th><th>Location</th><th></th></tr></thead>
        <tbody id="eventsBody"></tbody>
      </table>
    </div>
    ${eventsCache.length===0 ? `<div class="empty-state"><h2>No events yet</h2><p>Add the museum's first event.</p></div>` : ''}
  `;
  document.getElementById('addEventBtn').addEventListener('click', ()=>openEventModal(null));
  const tbody = document.getElementById('eventsBody');
  tbody.innerHTML = eventsCache.map(e => `
    <tr>
      <td class="title-cell">${escapeHtml(e.title)}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(e.date||'—')}</td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${escapeHtml(e.location||'—')}</td>
      <td><div class="row-actions">
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
  openModal(`
    <h2>${ev ? 'Edit event' : 'Add event'}</h2>
    <div class="form-grid">
      <div class="form-field full"><label>Title</label><input type="text" id="ef-title" value="${ev?escapeHtml(ev.title):''}" placeholder="e.g. Adlaw Sang Kabataan 2026"></div>
      <div class="form-field"><label>Date</label><input type="date" id="ef-date" value="${ev&&ev.date?escapeHtml(ev.date):''}"></div>
      <div class="form-field"><label>Location</label><input type="text" id="ef-location" value="${ev?escapeHtml(ev.location):''}" placeholder="e.g. Museo Sang Bata sa Negros"></div>
      <div class="form-field full">
        <label>Photos</label>
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

async function renderGalleryTab(contentEl){
  contentEl.innerHTML = `<div class="empty-state" style="color:var(--ink-soft);"><p>Loading gallery…</p></div>`;
  try{
    const { gallery } = await Api.listGallery();
    galleryCache = gallery;
    gallerySelection.clear();
  }catch(e){
    contentEl.innerHTML = `<div class="empty-state"><h2>Could not load gallery</h2><p>${escapeHtml(e.message)}</p></div>`;
    return;
  }
  contentEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 26px; gap:16px; flex-wrap:wrap;">
      <div style="display:flex; gap:12px; align-items:center;">
        <span id="gallerySelectionCount" style="font-size:13px; color:var(--ink-soft);">Select photos to delete</span>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn btn-danger btn-small" id="deleteSelectedGalleryBtn" disabled>Delete selected</button>
        <button class="btn btn-primary btn-small" id="addGalleryBtn">+ Add photos</button>
      </div>
    </div>
    <div class="gallery-grid" style="padding:0 26px 26px;" id="galleryAdminGrid"></div>
    ${galleryCache.length===0 ? `<div class="empty-state"><h2>No photos yet</h2><p>Upload the first gallery photo.</p></div>` : ''}
  `;
  document.getElementById('addGalleryBtn').addEventListener('click', ()=>openGalleryModal(null));
  document.getElementById('deleteSelectedGalleryBtn').addEventListener('click', async ()=>{
    if(gallerySelection.size === 0) return;
    if(!confirm(`Delete ${gallerySelection.size} selected photo${gallerySelection.size === 1 ? '' : 's'}?`)) return;
    try{
      for(const id of [...gallerySelection]){
        await Api.deleteGalleryItem(id);
      }
      toast(`${gallerySelection.size} photo${gallerySelection.size === 1 ? '' : 's'} deleted`);
      gallerySelection.clear();
      renderDashboard();
    }catch(e){
      toast(e.message, true);
    }
  });

  const grid = document.getElementById('galleryAdminGrid');
  grid.innerHTML = galleryCache.map(g => `
    <div class="gallery-item">
      <label class="gallery-item-checkbox">
        <input type="checkbox" class="gallery-select" data-id="${g.id}">
      </label>
      <img src="${escapeHtml(g.imagePath)}" alt="${escapeHtml(g.title)}">
      <div class="caption">
        ${g.title ? `<b>${escapeHtml(g.title)}</b>` : ''}
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="btn btn-ghost btn-small" style="color:#fff; border-color:rgba(255,255,255,0.4);" data-edit-gallery="${g.id}">Edit</button>
          <button class="btn btn-danger btn-small" data-delete-gallery="${g.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.gallery-select').forEach(chk=>chk.addEventListener('change', e=>{
    const id = e.target.dataset.id;
    if(!id) return;
    if(e.target.checked) gallerySelection.add(id);
    else gallerySelection.delete(id);
    updateGallerySelectionControls();
  }));
  grid.querySelectorAll('[data-edit-gallery]').forEach(b=>b.addEventListener('click', ()=>openGalleryModal(b.dataset.editGallery)));
  grid.querySelectorAll('[data-delete-gallery]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Delete this photo?')) return;
    try{ await Api.deleteGalleryItem(b.dataset.deleteGallery); toast('Photo deleted'); renderDashboard(); }
    catch(e){ toast(e.message, true); }
  }));

  function updateGallerySelectionControls(){
    const deleteSelectedBtn = document.getElementById('deleteSelectedGalleryBtn');
    const selectionCountEl = document.getElementById('gallerySelectionCount');
    if(deleteSelectedBtn) deleteSelectedBtn.disabled = gallerySelection.size === 0;
    if(selectionCountEl) selectionCountEl.textContent = gallerySelection.size > 0 ? `${gallerySelection.size} selected` : 'Select photos to delete';
  }
}

function openGalleryModal(id){
  const g = id ? galleryCache.find(x=>x.id===id) : null;
  let pendingImagePaths = g ? [g.imagePath] : [];
  openModal(`
    <h2>${g ? 'Edit photo' : 'Add photos'}</h2>
    <div class="form-grid">
      <div class="form-field full">
        <label>Image</label>
        <input type="file" id="gf-image-file" ${g ? '' : 'multiple'} accept="image/png,image/jpeg,image/webp,image/gif">
        <div id="gfImagePreviewList"></div>
        <div id="gfUploadStatus" style="font-size:12px; color:var(--ink-soft);"></div>
      </div>
      <div class="form-field full"><label>Title</label><input type="text" id="gf-title" value="${g?escapeHtml(g.title):''}" placeholder="e.g. Carnival Exhibit"></div>
      <div class="form-field full"><label>Caption</label><input type="text" id="gf-caption" value="${g?escapeHtml(g.caption):''}" placeholder="Short caption shown under the photo"></div>
      <div class="form-error" id="gfError"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost dark" id="gfCancel">Cancel</button>
      <button class="btn btn-primary" id="gfSave">${g?'Save changes':'Add photos'}</button>
    </div>`);
  renderImagePreviewList(pendingImagePaths, 'gfImagePreviewList');
  document.getElementById('gf-image-file').addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    if(g && files.length > 1){
      document.getElementById('gfUploadStatus').textContent = 'Please choose only one image when editing a single gallery item.';
      return;
    }
    const status = document.getElementById('gfUploadStatus');
    status.textContent = 'Uploading…';
    try{
      for(const file of files){
        const { path } = await Api.uploadImage(file);
        if(g){ pendingImagePaths = [path]; }
        else { pendingImagePaths.push(path); }
      }
      renderImagePreviewList(pendingImagePaths, 'gfImagePreviewList');
      status.textContent = `${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} ready.`;
    }catch(err){ status.textContent = 'Upload failed: ' + err.message; }
  });
  document.getElementById('gfCancel').addEventListener('click', closeModal);
  document.getElementById('gfSave').addEventListener('click', async ()=>{
    const errorEl = document.getElementById('gfError');
    if(!pendingImagePaths.length){ errorEl.textContent = 'Please upload at least one image.'; return; }
    const title = document.getElementById('gf-title').value.trim();
    const caption = document.getElementById('gf-caption').value.trim();
    try{
      if(g){
        const payload = { imagePath: pendingImagePaths[0], title, caption };
        await Api.updateGalleryItem(g.id, payload);
        toast('Photo updated');
      } else {
        for(const path of pendingImagePaths){
          await Api.createGalleryItem({ imagePath: path, title, caption });
        }
        toast(`${pendingImagePaths.length} photo${pendingImagePaths.length === 1 ? '' : 's'} added`);
      }
      closeModal();
      renderDashboard();
    }catch(err){ errorEl.textContent = err.message; }
  });
}

boot();
