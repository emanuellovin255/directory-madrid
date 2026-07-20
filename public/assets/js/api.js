/* =========================================================================
   api.js — Wrapper fetch peste API-ul REST (DDM.api).
   Toate cererile trimit cookie-ul de sesiune (same-origin).
   ========================================================================= */
window.DDM = window.DDM || {};

DDM.api = (function () {
  async function req(method, url, body) {
    const opt = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let data = null;
    try { data = await r.json(); } catch { /* fără body */ }
    if (!r.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + r.status));
      err.status = r.status; err.data = data;
      throw err;
    }
    return data;
  }
  const enc = encodeURIComponent;
  function qs(params) {
    const p = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
    return p.length ? '?' + p.map(([k, v]) => enc(k) + '=' + enc(v)).join('&') : '';
  }

  return {
    // Negocios
    listBusinesses: (params) => req('GET', '/api/businesses' + qs(params)).then(d => d.businesses),
    getBusiness: id => req('GET', '/api/businesses/' + enc(id)),
    createBusiness: b => req('POST', '/api/businesses', b),
    updateBusiness: (id, b) => req('PUT', '/api/businesses/' + enc(id), b),
    deleteBusiness: id => req('DELETE', '/api/businesses/' + enc(id)),
    setFeatured: (id, val) => req('POST', '/api/businesses/' + enc(id) + '/featured', { featured: val }),
    resetDemo: () => req('POST', '/api/businesses/reset-demo'),
    exportData: () => req('GET', '/api/export'),
    importData: businesses => req('POST', '/api/import', { businesses }),
    upload: dataUrl => req('POST', '/api/upload', { dataUrl }),
    extractFromUrl: url => req('POST', '/api/extract', { url }),

    // Taxonomía
    categories: () => req('GET', '/api/categories'),
    districts: () => req('GET', '/api/districts').then(d => d.districts),
    neighborhoods: districtId => req('GET', '/api/districts/' + enc(districtId) + '/neighborhoods').then(d => d.neighborhoods),
    metros: () => req('GET', '/api/metros').then(d => d.metros),
    createCategory: c => req('POST', '/api/categories', c),
    updateCategory: (id, c) => req('PUT', '/api/categories/' + enc(id), c),
    deleteCategory: id => req('DELETE', '/api/categories/' + enc(id)),
    createMetro: m => req('POST', '/api/metros', m),
    updateMetro: (id, m) => req('PUT', '/api/metros/' + enc(id), m),
    deleteMetro: id => req('DELETE', '/api/metros/' + enc(id)),
    createNeighborhood: n => req('POST', '/api/neighborhoods', n),

    // Auth
    login: (username, password) => req('POST', '/api/auth/login', { username, password }),
    logout: () => req('POST', '/api/auth/logout'),
    me: () => req('GET', '/api/auth/me'),

    // Analytics
    trackVisit: () => req('POST', '/api/track/visit').catch(() => {}),
    trackView: id => req('POST', '/api/track/view/' + enc(id)).catch(() => {}),
    trackContact: type => req('POST', '/api/track/contact', { type }).catch(() => {}),
    stats: () => req('GET', '/api/stats'),
    resetStats: () => req('POST', '/api/analytics/reset'),
  };
})();
