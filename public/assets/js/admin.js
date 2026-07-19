/* =========================================================================
   admin.js — Panel de administración (pe API real).
   Auth reală (redirect la login), CRUD prin API, upload pe server,
   export/import, statistici din /api/stats.
   ========================================================================= */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.DDM, IC = D.icons;
  const esc = D.esc, attr = D.attr, fmt = D.fmt, toast = D.toast, api = D.api;

  const SOCIAL_KEYS = [
    { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/…' },
    { key: 'facebook', label: 'Facebook', ph: 'https://facebook.com/…' },
    { key: 'twitter', label: 'X (Twitter)', ph: 'https://x.com/…' },
    { key: 'tiktok', label: 'TikTok', ph: 'https://tiktok.com/@…' },
    { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/company/…' },
    { key: 'youtube', label: 'YouTube', ph: 'https://youtube.com/@…' },
  ];

  let formServices = [];
  let formPhoto = null;
  let editingId = null;
  let cache = [];       // ultima listă de clinici

  /* ------------------------------ Tabla --------------------------------- */
  async function renderTable() {
    let list;
    try { list = await api.listClinics(); }
    catch (e) { toast('No se pudieron cargar las clínicas', 'err'); return; }
    cache = list;
    $('#clinicCount').textContent = `${list.length} ${list.length === 1 ? 'clínica' : 'clínicas'} en el directorio`;
    const rows = $('#clinicRows');
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">No hay clínicas. <a href="#" id="emptyNew">Añade la primera</a>.</td></tr>`;
      const en = $('#emptyNew'); if (en) en.addEventListener('click', e => { e.preventDefault(); openDrawer(); });
      return;
    }
    rows.innerHTML = list.map(c => `
      <tr>
        <td><div class="t-clinic"><img src="${attr(D.clinicPhoto(c))}" alt="" /><div><div class="t-name">${esc(c.name)}</div><div class="t-zone">${esc(c.address || c.zone || '')}</div></div></div></td>
        <td>${esc(c.zone) || '<span class="muted">—</span>'}</td>
        <td>${c.services.length} <span class="muted">serv.</span></td>
        <td>${c.rating != null ? '★ ' + D.rating1(c.rating) : '<span class="muted">—</span>'}</td>
        <td>${c.featured ? '<span class="pill pill-gold">★ Sí</span>' : '<span class="pill pill-muted">No</span>'}</td>
        <td><div class="row-actions">
          <button class="icon-btn gold ${c.featured ? 'on' : ''}" data-act="feature" data-id="${attr(c.id)}" title="Destacar">${IC.star}</button>
          <button class="icon-btn" data-act="edit" data-id="${attr(c.id)}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-act="delete" data-id="${attr(c.id)}" title="Eliminar">${IC.trash}</button>
        </div></td>
      </tr>`).join('');
  }

  function bindClinics() {
    $('#clinicRows').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      const c = cache.find(x => x.id === id);
      if (act === 'edit') openDrawer(id);
      else if (act === 'feature') { try { await api.setFeatured(id, !(c && c.featured)); renderTable(); } catch { toast('Error', 'err'); } }
      else if (act === 'delete') {
        if (confirm(`¿Eliminar “${c ? c.name : ''}”? Esta acción no se puede deshacer.`)) {
          try { await api.deleteClinic(id); renderTable(); toast('Clínica eliminada'); } catch { toast('No se pudo eliminar', 'err'); }
        }
      }
    });
    $('#newBtn').addEventListener('click', () => openDrawer());
    $('#exportBtn').addEventListener('click', doExport);
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#importInput').addEventListener('change', doImport);
    $('#resetBtn').addEventListener('click', async () => {
      if (confirm('¿Restaurar las 3 clínicas de demostración? Se perderán tus cambios actuales.')) {
        try { await api.resetDemo(); await renderTable(); toast('Datos demo restaurados'); }
        catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo restaurar', 'err'); }
      }
    });
  }

  /* ------------------------------ Drawer -------------------------------- */
  function buildHoursEditor() {
    $('#f-hours').innerHTML = D.DAYS.map(d =>
      `<div class="hours-editor-row"><label>${d.label}</label><input class="input" data-day="${d.key}" placeholder="09:00 – 20:00  ·  Cerrado" /></div>`).join('');
  }
  function buildSocialInputs() {
    $('#f-social').innerHTML = SOCIAL_KEYS.map(s =>
      `<div class="field"><label>${s.label}</label><input class="input" data-social="${s.key}" placeholder="${attr(s.ph)}" /></div>`).join('');
  }
  function renderServices() {
    const cont = $('#f-services'), input = $('#f-services-input');
    cont.querySelectorAll('.chip-x').forEach(n => n.remove());
    formServices.forEach((s, idx) => {
      const el = document.createElement('span');
      el.className = 'chip-x';
      el.innerHTML = `${esc(s)}<button type="button" data-idx="${idx}" aria-label="Quitar">${IC.x}</button>`;
      cont.insertBefore(el, input);
    });
  }
  function addService(raw) {
    String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      if (!formServices.some(x => x.toLowerCase() === s.toLowerCase())) formServices.push(s);
    });
    renderServices();
  }
  function setPreview() { $('#f-photo-preview').src = formPhoto || D.placeholderImage($('#f-name').value || 'Nueva clínica'); }

  function openDrawer(id) {
    editingId = id || null;
    const c = id ? cache.find(x => x.id === id) : null;
    $('#drawerTitle').textContent = c ? 'Editar clínica' : 'Nueva clínica';
    ['f-name', 'f-zone', 'f-address', 'f-about', 'f-phone', 'f-email', 'f-website', 'f-rating', 'f-reviews'].forEach(k => { $('#' + k).value = ''; });
    $('#f-featured').checked = false;
    $$('#f-hours [data-day]').forEach(i => { i.value = ''; });
    $$('#f-social [data-social]').forEach(i => { i.value = ''; });
    formServices = []; formPhoto = null;

    if (c) {
      $('#f-name').value = c.name; $('#f-zone').value = c.zone; $('#f-address').value = c.address;
      $('#f-about').value = c.about; $('#f-phone').value = c.phone; $('#f-email').value = c.email;
      $('#f-website').value = c.website;
      $('#f-rating').value = c.rating != null ? c.rating : '';
      $('#f-reviews').value = c.reviews || '';
      $('#f-featured').checked = !!c.featured;
      formServices = c.services.slice();
      formPhoto = c.photo || null;
      $$('#f-hours [data-day]').forEach(i => { i.value = (c.hours && c.hours[i.dataset.day]) || ''; });
      $$('#f-social [data-social]').forEach(i => { i.value = (c.social && c.social[i.dataset.social]) || ''; });
    }
    renderServices(); setPreview();
    $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawerBackdrop').classList.add('open');
    $('#drawer').querySelector('.drawer-scroll').scrollTop = 0;
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), 60);
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawerBackdrop').classList.remove('open');
  }

  function gather() {
    const hours = {};
    $$('#f-hours [data-day]').forEach(i => { hours[i.dataset.day] = i.value.trim() || 'Cerrado'; });
    const social = {};
    $$('#f-social [data-social]').forEach(i => { if (i.value.trim()) social[i.dataset.social] = i.value.trim(); });
    const rating = parseFloat($('#f-rating').value);
    return {
      name: $('#f-name').value, zone: $('#f-zone').value, address: $('#f-address').value,
      about: $('#f-about').value, services: formServices.slice(),
      phone: $('#f-phone').value, email: $('#f-email').value, website: $('#f-website').value,
      rating: isNaN(rating) ? null : Math.min(5, Math.max(0, rating)),
      reviews: parseInt($('#f-reviews').value, 10) || 0,
      featured: $('#f-featured').checked, photo: formPhoto, hours, social,
    };
  }
  async function save() {
    const data = gather();
    if (!data.name.trim()) { toast('El nombre es obligatorio', 'err'); $('#f-name').focus(); return; }
    $('#drawerSave').disabled = true;
    try {
      if (editingId) await api.updateClinic(editingId, data); else await api.createClinic(data);
      closeDrawer(); await renderTable();
      toast(editingId ? 'Clínica actualizada' : 'Clínica añadida');
    } catch (e) {
      toast(e.status === 401 ? 'Sesión expirada' : ('No se pudo guardar: ' + (e.message || '')), 'err');
      if (e.status === 401) setTimeout(() => location.replace('login.html'), 800);
    } finally { $('#drawerSave').disabled = false; }
  }

  function bindDrawer() {
    $('#drawerSave').addEventListener('click', save);
    $('#drawerCancel').addEventListener('click', closeDrawer);
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#drawerBackdrop').addEventListener('click', closeDrawer);

    $('#f-services-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addService(e.target.value); e.target.value = ''; }
      else if (e.key === 'Backspace' && !e.target.value && formServices.length) { formServices.pop(); renderServices(); }
    });
    $('#f-services-input').addEventListener('change', e => { if (e.target.value) { addService(e.target.value); e.target.value = ''; } });
    $('#f-services').addEventListener('click', e => {
      const b = e.target.closest('button[data-idx]');
      if (b) { formServices.splice(+b.dataset.idx, 1); renderServices(); }
      else if (e.target === $('#f-services')) $('#f-services-input').focus();
    });

    $('#f-name').addEventListener('input', () => { if (!formPhoto) setPreview(); });
    $('#f-photo-btn').addEventListener('click', () => $('#f-photo-input').click());
    $('#f-photo-clear').addEventListener('click', () => { formPhoto = null; setPreview(); });
    $('#f-photo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      $('#f-photo-btn').disabled = true;
      try {
        const dataUrl = await resizeImage(file, 900);
        const r = await api.upload(dataUrl);
        formPhoto = r.url; setPreview(); toast('Imagen subida');
      } catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo subir la imagen', 'err'); }
      finally { $('#f-photo-btn').disabled = false; e.target.value = ''; }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer(); });
  }

  function resizeImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = ev => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          try { resolve(cv.toDataURL('image/jpeg', 0.82)); } catch (e) { reject(e); }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* --------------------------- Export / Import -------------------------- */
  async function doExport() {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'clinicas-madrid.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Datos exportados');
    } catch { toast('No se pudo exportar', 'err'); }
  }
  function doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const list = Array.isArray(parsed) ? parsed : parsed.clinics;
        if (!Array.isArray(list)) throw new Error('falta "clinics"');
        const r = await api.importData(list);
        await renderTable();
        toast(`Importadas ${r.clinics.length} clínicas`);
      } catch (err) { toast('Archivo no válido: ' + (err.message || 'error'), 'err'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ----------------------------- Estadísticas --------------------------- */
  function statCard(cls, icon, val, lbl, trend, trendUp) {
    const dir = trendUp === true ? 'up' : trendUp === false ? 'down' : '';
    return `<div class="stat-card"><div class="s-icn ${cls}">${icon}</div><div class="s-val">${fmt(val)}</div><div class="s-lbl">${esc(lbl)}</div>${trend ? `<div class="s-trend ${dir}">${esc(trend)}</div>` : ''}</div>`;
  }
  function renderBarChart(container, series) {
    if (!container) return;
    const slotW = 100, padTop = 26, padBottom = 30, plotH = 158;
    const H = padTop + plotH + padBottom, W = slotW * series.length;
    const max = Math.max.apply(null, series.map(s => s.value).concat([1]));
    let bars = '';
    series.forEach((s, i) => {
      const cx = i * slotW + slotW / 2, barW = 50, bx = cx - barW / 2;
      const barH = Math.max(3, (s.value / max) * plotH), by = padTop + (plotH - barH);
      bars += `<rect class="chart-bar-bg" x="${bx}" y="${padTop}" width="${barW}" height="${plotH}" rx="8"/>` +
        `<rect class="chart-bar" x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="8"><title>${s.label}: ${fmt(s.value)}</title></rect>` +
        `<text class="chart-value" x="${cx}" y="${by - 8}" text-anchor="middle">${fmt(s.value)}</text>` +
        `<text class="chart-label" x="${cx}" y="${padTop + plotH + 20}" text-anchor="middle">${s.label}</text>`;
    });
    container.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Visitas por mes">${bars}</svg>`;
  }
  async function renderStats() {
    let s;
    try { s = await api.stats(); }
    catch (e) { if (e.status === 401) location.replace('login.html'); return; }
    const t = s.totals;
    $('#statRow').innerHTML =
      statCard('teal', IC.users, t.total, 'Visitas totales', t.growth != null ? `${t.growth >= 0 ? '▲' : '▼'} ${Math.abs(t.growth)}% vs. mes anterior` : '', t.growth >= 0) +
      statCard('blue', IC.eye, t.thisMonth, 'Visitas este mes', 'en curso', null) +
      statCard('gold', IC.card, t.totalViews, 'Fichas vistas', '') +
      statCard('pink', IC.phone, t.contactsPhone + t.contactsWeb, 'Clics de contacto', `${fmt(t.contactsPhone)} tel · ${fmt(t.contactsWeb)} web`);
    renderBarChart($('#chart'), s.series);
    $('#topList').innerHTML = s.top.length ? s.top.map((x, i) => `
      <div class="rank-item"><span class="rank-n">${i + 1}</span>
        <img class="rank-thumb" src="${attr(D.clinicPhoto(x))}" alt="" />
        <div class="rank-name">${esc(x.name)}<small>${esc(x.zone || '')}</small></div>
        <span class="rank-val">${fmt(x.views)} <small>vistas</small></span>
      </div>`).join('') : '<p class="muted">Aún no hay datos de vistas.</p>';
  }
  function bindStats() {
    $('#resetStatsBtn').addEventListener('click', async () => {
      if (confirm('¿Reiniciar los datos de estadísticas al histórico demo?')) {
        try { await api.resetStats(); renderStats(); toast('Estadísticas reiniciadas'); } catch { toast('Error', 'err'); }
      }
    });
  }

  /* --------------------------- View switching --------------------------- */
  function switchView(v) {
    $$('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $('#view-clinicas').classList.toggle('hidden', v !== 'clinicas');
    $('#view-stats').classList.toggle('hidden', v !== 'stats');
    if (v === 'stats') renderStats();
  }

  /* ------------------------------- Boot --------------------------------- */
  async function boot() {
    // gardă de autentificare
    let me;
    try { me = await api.me(); } catch { me = { user: null }; }
    if (!me.user) { location.replace('login.html'); return; }

    $('#serviceList').innerHTML = D.SERVICE_CATALOG.map(s => `<option value="${attr(s)}">`).join('');
    buildHoursEditor(); buildSocialInputs();
    bindClinics(); bindDrawer(); bindStats();
    $$('.admin-nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('#logoutBtn').addEventListener('click', async e => { e.preventDefault(); try { await api.logout(); } catch {} location.replace('login.html'); });
    $('#adminApp').classList.remove('hidden');
    renderTable();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
