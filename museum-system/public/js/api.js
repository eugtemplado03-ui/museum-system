const Api = (() => {
  const TOKEN_KEY = 'museum_admin_token';
  const VISITOR_KEY = 'museum_visitor_id';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  let _staticDataCache = null;
  async function getStaticData() {
    if (_staticDataCache) return _staticDataCache;
    const paths = ['data.json', './data.json', '/data.json', '/museum-system/data.json'];
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          _staticDataCache = await res.json();
          return _staticDataCache;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  async function fallbackStatic(path, method) {
    if (method && method !== 'GET') return null;
    const db = await getStaticData();
    if (!db) return null;

    // Route matching for static fallback
    if (path === '/api/exhibits') return { exhibits: db.exhibits || [] };
    if (path.startsWith('/api/exhibits/categories')) return { categories: db.categories || ['Marine & Nature', 'Touch & Play', 'Toys & Collections', 'Character & Heritage', 'Environmental', 'Reading & Learning', 'Other'] };
    if (path.startsWith('/api/exhibits/')) {
      const code = decodeURIComponent(path.replace('/api/exhibits/', '').split('?')[0]);
      if (code && !code.includes('/')) {
        const ex = (db.exhibits || []).find(e => (e.code && e.code.toLowerCase() === code.toLowerCase()) || e.id === code);
        if (ex) return { exhibit: ex };
      }
    }
    if (path === '/api/programs') return { programs: db.programs || [] };
    if (path.startsWith('/api/programs/')) {
      const id = decodeURIComponent(path.replace('/api/programs/', '').split('?')[0]);
      const p = (db.programs || []).find(item => item.id === id);
      if (p) return { program: p };
    }
    if (path === '/api/events') return { events: db.events || [] };
    if (path.startsWith('/api/events/')) {
      const id = decodeURIComponent(path.replace('/api/events/', '').split('?')[0]);
      const ev = (db.events || []).find(item => item.id === id);
      if (ev) return { event: ev };
    }
    if (path === '/api/gallery') return { gallery: db.gallery || [] };
    if (path === '/api/museum-info') return { info: db.museumInfo || {} };
    if (path.startsWith('/api/favorites/')) return { favorites: [] };
    if (path.includes('/ratings')) return { ratings: [], average: 5, count: 0 };
    return null;
  }

  async function request(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const res = await fetch(path, { ...opts, headers });
      let data = null;
      try { data = await res.json(); } catch (e) { /* no body */ }
      if (!res.ok) {
        // If 404 on GET, try static fallback
        if (res.status === 404 && method === 'GET') {
          const fallback = await fallbackStatic(path, method);
          if (fallback) return fallback;
        }
        const err = new Error((data && data.error) || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (method === 'GET') {
        const fallback = await fallbackStatic(path, method);
        if (fallback) return fallback;
      }
      throw err;
    }
  }

  return {
    getToken, setToken, clearToken, getVisitorId,
    login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/api/auth/me'),
    listExhibits: () => request('/api/exhibits'),
    listRecommendedExhibits: (limit = 6) => request('/api/exhibits/recommended?limit=' + limit),
    getExhibit: (code) => request('/api/exhibits/' + encodeURIComponent(code)),
    createExhibit: (payload) => request('/api/exhibits', { method: 'POST', body: JSON.stringify(payload) }),
    updateExhibit: (id, payload) => request('/api/exhibits/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteExhibit: (id) => request('/api/exhibits/' + id, { method: 'DELETE' }),
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return request('/api/exhibits/upload-image', { method: 'POST', body: fd });
    },
    uploadMedia: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('/api/exhibits/upload-media', { method: 'POST', body: fd });
    },
    qrUrl: (code) => `/api/exhibits/${encodeURIComponent(code)}/qr`,
    visitorCheckinQrUrl: () => `/api/visitors/checkin/qr`,

    trackView: (code, source) => request(`/api/exhibits/${encodeURIComponent(code)}/track`, { method: 'POST', body: JSON.stringify({ source }) }).catch(()=>{}),

    getRatings: (code) => request(`/api/exhibits/${encodeURIComponent(code)}/ratings`),
    submitRating: (code, rating, comment, visitorName) => request(`/api/exhibits/${encodeURIComponent(code)}/ratings`, {
      method: 'POST', body: JSON.stringify({ visitorId: getVisitorId(), rating, comment, visitorName })
    }),

    listFavorites: () => request('/api/favorites/' + encodeURIComponent(getVisitorId())),
    addFavorite: (exhibitId) => request('/api/favorites', { method: 'POST', body: JSON.stringify({ visitorId: getVisitorId(), exhibitId }) }),
    removeFavorite: (exhibitId) => request(`/api/favorites/${encodeURIComponent(getVisitorId())}/${encodeURIComponent(exhibitId)}`, { method: 'DELETE' }),

    adminAnalytics: () => request('/api/admin/analytics'),
    adminRatings: () => request('/api/admin/ratings'),
    adminDeleteRating: (id) => request('/api/admin/ratings/' + id, { method: 'DELETE' }),
    adminDailyStats: (days = 30) => request('/api/admin/analytics/daily?days=' + days),

    listPrograms: () => request('/api/programs'),
    getProgram: (id) => request('/api/programs/' + encodeURIComponent(id)),
    createProgram: (payload) => request('/api/programs', { method: 'POST', body: JSON.stringify(payload) }),
    updateProgram: (id, payload) => request('/api/programs/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteProgram: (id) => request('/api/programs/' + id, { method: 'DELETE' }),

    listEvents: () => request('/api/events'),
    getEvent: (id) => request('/api/events/' + encodeURIComponent(id)),
    createEvent: (payload) => request('/api/events', { method: 'POST', body: JSON.stringify(payload) }),
    updateEvent: (id, payload) => request('/api/events/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteEvent: (id) => request('/api/events/' + id, { method: 'DELETE' }),

    listCategories: () => request('/api/exhibits/categories'),
    createCategory: (category) => request('/api/exhibits/categories', { method: 'POST', body: JSON.stringify({ category }) }),
    renameCategory: (oldCategory, newCategory) => request('/api/exhibits/categories/' + encodeURIComponent(oldCategory), { method: 'PUT', body: JSON.stringify({ category: newCategory }) }),
    deleteCategory: (category) => request('/api/exhibits/categories/' + encodeURIComponent(category), { method: 'DELETE' }),
    assignExhibitsToCategory: (category, exhibitIds) => request('/api/exhibits/categories/' + encodeURIComponent(category) + '/assign', { method: 'POST', body: JSON.stringify({ exhibitIds }) }),

    listGallery: () => request('/api/gallery'),
    createGalleryItem: (payload) => request('/api/gallery', { method: 'POST', body: JSON.stringify(payload) }),
    updateGalleryItem: (id, payload) => request('/api/gallery/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteGalleryItem: (id) => request('/api/gallery/' + id, { method: 'DELETE' }),

    listVisitors: (query = '') => request('/api/visitors' + (query ? (query.startsWith('?') ? query : '?' + query) : '')),
    getVisitorStats: () => request('/api/visitors/stats'),
    getVisitor: (id) => request('/api/visitors/' + encodeURIComponent(id)),
    createVisitor: (payload) => request('/api/visitors', { method: 'POST', body: JSON.stringify(payload) }),
    updateVisitor: (id, payload) => request('/api/visitors/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteVisitor: (id) => request('/api/visitors/' + id, { method: 'DELETE' }),

    listArtifactLogs: (query = '') => request('/api/artifact-logs' + (query ? (query.startsWith('?') ? query : '?' + query) : '')),
    getArtifactLogStats: () => request('/api/artifact-logs/stats'),
    getArtifactLog: (id) => request('/api/artifact-logs/' + encodeURIComponent(id)),
    createArtifactLog: (payload) => request('/api/artifact-logs', { method: 'POST', body: JSON.stringify(payload) }),
    updateArtifactLog: (id, payload) => request('/api/artifact-logs/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteArtifactLog: (id) => request('/api/artifact-logs/' + id, { method: 'DELETE' }),

    getMuseumInfo: () => request('/api/museum-info'),
    updateMuseumInfo: (payload) => request('/api/museum-info', { method: 'PUT', body: JSON.stringify(payload) })
  };
})();
