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

  async function request(path, opts = {}) {
    const headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    getToken, setToken, clearToken, getVisitorId,
    login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/api/auth/me'),
    listExhibits: () => request('/api/exhibits'),
    getExhibit: (code) => request('/api/exhibits/' + encodeURIComponent(code)),
    createExhibit: (payload) => request('/api/exhibits', { method: 'POST', body: JSON.stringify(payload) }),
    updateExhibit: (id, payload) => request('/api/exhibits/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteExhibit: (id) => request('/api/exhibits/' + id, { method: 'DELETE' }),
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return request('/api/exhibits/upload-image', { method: 'POST', body: fd });
    },
    qrUrl: (code) => `/api/exhibits/${encodeURIComponent(code)}/qr`,

    trackView: (code, source) => request(`/api/exhibits/${encodeURIComponent(code)}/track`, { method: 'POST', body: JSON.stringify({ source }) }).catch(()=>{}),

    getRatings: (code) => request(`/api/exhibits/${encodeURIComponent(code)}/ratings`),
    submitRating: (code, rating, comment) => request(`/api/exhibits/${encodeURIComponent(code)}/ratings`, {
      method: 'POST', body: JSON.stringify({ visitorId: getVisitorId(), rating, comment })
    }),

    listFavorites: () => request('/api/favorites/' + encodeURIComponent(getVisitorId())),
    addFavorite: (exhibitId) => request('/api/favorites', { method: 'POST', body: JSON.stringify({ visitorId: getVisitorId(), exhibitId }) }),
    removeFavorite: (exhibitId) => request(`/api/favorites/${encodeURIComponent(getVisitorId())}/${encodeURIComponent(exhibitId)}`, { method: 'DELETE' }),

    adminAnalytics: () => request('/api/admin/analytics'),
    adminRatings: () => request('/api/admin/ratings'),
    adminDeleteRating: (id) => request('/api/admin/ratings/' + id, { method: 'DELETE' }),

    listPrograms: () => request('/api/programs'),
    createProgram: (payload) => request('/api/programs', { method: 'POST', body: JSON.stringify(payload) }),
    updateProgram: (id, payload) => request('/api/programs/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteProgram: (id) => request('/api/programs/' + id, { method: 'DELETE' }),

    listEvents: () => request('/api/events'),
    createEvent: (payload) => request('/api/events', { method: 'POST', body: JSON.stringify(payload) }),
    updateEvent: (id, payload) => request('/api/events/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteEvent: (id) => request('/api/events/' + id, { method: 'DELETE' }),

    listGallery: () => request('/api/gallery'),
    createGalleryItem: (payload) => request('/api/gallery', { method: 'POST', body: JSON.stringify(payload) }),
    updateGalleryItem: (id, payload) => request('/api/gallery/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteGalleryItem: (id) => request('/api/gallery/' + id, { method: 'DELETE' })
  };
})();
