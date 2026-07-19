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

  return {
    // Clínicas
    listClinics: () => req('GET', '/api/clinics').then(d => d.clinics),
    getClinic: id => req('GET', '/api/clinics/' + enc(id)),
    createClinic: c => req('POST', '/api/clinics', c),
    updateClinic: (id, c) => req('PUT', '/api/clinics/' + enc(id), c),
    deleteClinic: id => req('DELETE', '/api/clinics/' + enc(id)),
    setFeatured: (id, val) => req('POST', '/api/clinics/' + enc(id) + '/featured', { featured: val }),
    exportData: () => req('GET', '/api/export'),
    importData: clinics => req('POST', '/api/import', { clinics }),
    resetDemo: () => req('POST', '/api/clinics/reset-demo'),
    upload: dataUrl => req('POST', '/api/upload', { dataUrl }),

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
