/* =========================================================================
   admin.js — Panel de administración (Reformas Madrid).
   Auth real, CRUD de negocios con taxonomía estructurada (categorías,
   distrito→barrio, metro), import por URL con override, y gestión de
   taxonomía (categorías + estaciones de metro).
   ========================================================================= */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const D = window.DDM, IC = D.icons;
  const esc = D.esc, attr = D.attr, fmt = D.fmt, norm = D.norm, toast = D.toast, api = D.api;

  const SOCIAL_KEYS = [
    { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/…' },
    { key: 'facebook', label: 'Facebook', ph: 'https://facebook.com/…' },
    { key: 'twitter', label: 'X (Twitter)', ph: 'https://x.com/…' },
    { key: 'tiktok', label: 'TikTok', ph: 'https://tiktok.com/@…' },
    { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/company/…' },
    { key: 'youtube', label: 'YouTube', ph: 'https://youtube.com/@…' },
  ];

  let categoriesTree = [], categoriesFlat = [], districts = [], metros = [];
  const barrioCache = {};
  let formPhoto = null, formLogo = null, formPhotos = [], editingId = null, cache = [];

  /* --------------------------- Taxonomía (carga) ------------------------ */
  async function loadTaxonomy() {
    const c = await api.categories();
    categoriesTree = c.categories || []; categoriesFlat = c.flat || [];
    districts = await api.districts();
    metros = await api.metros();
  }
  function fillDistrictSelects() {
    const opts = '<option value="">Selecciona distrito…</option>' + districts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    $('#f-district').innerHTML = opts;
    $('#ab-district').innerHTML = districts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  }
  function buildCategoryChecklist() {
    $('#f-categories').innerHTML = categoriesTree.map(c => `
      <div class="tax-check-group">
        <label class="tax-check-parent"><input type="checkbox" data-cat="${c.id}" /> <b>${esc(c.name)}</b></label>
        <div class="tax-check-children">
          ${(c.children || []).map(s => `<label class="tax-check-item"><input type="checkbox" data-cat="${s.id}" /> ${esc(s.name)}</label>`).join('')}
        </div>
      </div>`).join('');
  }
  function buildMetroChecklist() {
    $('#f-metros').innerHTML = metros.map(m => `<label class="metro-check-item" data-name="${attr(norm(m.name))}"><input type="checkbox" data-metro="${m.id}" /> ${esc(m.name)}${m.lines && m.lines.length ? ` <span class="ml-lines">L${m.lines.join(' · L')}</span>` : ''}</label>`).join('');
  }
  function filterMetros(q) {
    const n = norm(q);
    $$('#f-metros .metro-check-item').forEach(el => { el.style.display = !n || el.dataset.name.includes(n) ? '' : 'none'; });
  }
  async function loadBarrios(districtId, selectId) {
    const sel = $('#f-barrio');
    if (!districtId) { sel.innerHTML = '<option value="">Selecciona distrito primero</option>'; sel.disabled = true; return; }
    let list = barrioCache[districtId];
    if (!list) { list = await api.neighborhoods(districtId); barrioCache[districtId] = list; }
    sel.innerHTML = '<option value="">Todo el distrito</option>' + list.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    sel.disabled = false;
    if (selectId != null) sel.value = String(selectId);
  }

  /* ------------------------------ Tabla --------------------------------- */
  async function renderBusinesses() {
    let list;
    try { list = await api.listBusinesses(); }
    catch (e) { toast('No se pudieron cargar los negocios', 'err'); return; }
    cache = list;
    $('#bizCount').textContent = `${list.length} ${list.length === 1 ? 'negocio' : 'negocios'} en el directorio`;
    const rows = $('#bizRows');
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">No hay negocios. <a href="#" id="emptyNew">Añade el primero</a>.</td></tr>`;
      const en = $('#emptyNew'); if (en) en.addEventListener('click', e => { e.preventDefault(); openDrawer(); });
      return;
    }
    rows.innerHTML = list.map(b => `
      <tr>
        <td><div class="t-clinic"><img src="${attr(bizPhoto(b))}" alt="" /><div><div class="t-name">${esc(b.name)}</div><div class="t-zone">${esc(b.address || '')}</div></div></div></td>
        <td>${esc(b.zone) || '<span class="muted">—</span>'}</td>
        <td>${(b.categories || []).length} <span class="muted">serv.</span></td>
        <td>${b.rating != null ? '★ ' + D.rating1(b.rating) : '<span class="muted">—</span>'}</td>
        <td>${b.featured ? '<span class="pill pill-gold">★ Sí</span>' : '<span class="pill pill-muted">No</span>'}</td>
        <td><div class="row-actions">
          <button class="icon-btn gold ${b.featured ? 'on' : ''}" data-act="feature" data-id="${attr(b.id)}" title="Destacar">${IC.star}</button>
          <button class="icon-btn" data-act="edit" data-id="${attr(b.id)}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-act="delete" data-id="${attr(b.id)}" title="Eliminar">${IC.trash}</button>
        </div></td>
      </tr>`).join('');
  }
  function bizPhoto(b) { return (b && b.photo) ? b.photo : D.placeholderImage(b ? b.name : ''); }

  function bindBusinesses() {
    $('#bizRows').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      const b = cache.find(x => x.id === id);
      if (act === 'edit') openDrawer(id);
      else if (act === 'feature') { try { await api.setFeatured(id, !(b && b.featured)); renderBusinesses(); } catch { toast('Error', 'err'); } }
      else if (act === 'delete') {
        if (confirm(`¿Eliminar “${b ? b.name : ''}”? Esta acción no se puede deshacer.`)) {
          try { await api.deleteBusiness(id); renderBusinesses(); toast('Negocio eliminado'); } catch { toast('No se pudo eliminar', 'err'); }
        }
      }
    });
    $('#newBtn').addEventListener('click', () => openDrawer());
    $('#exportBtn').addEventListener('click', doExport);
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#importInput').addEventListener('change', doImport);
    $('#resetBtn').addEventListener('click', async () => {
      if (confirm('¿Restaurar los negocios de demostración? Se perderán tus cambios actuales.')) {
        try { await api.resetDemo(); await renderBusinesses(); toast('Datos demo restaurados'); }
        catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo restaurar', 'err'); }
      }
    });
  }

  /* ------------------------------ Drawer -------------------------------- */
  function buildHoursEditor() {
    $('#f-hours').innerHTML = D.DAYS.map(d =>
      `<div class="hours-editor-row"><label>${d.label}</label><input class="input" data-day="${d.key}" placeholder="09:00 – 19:00  ·  Cerrado" /></div>`).join('');
  }
  function buildSocialInputs() {
    $('#f-social').innerHTML = SOCIAL_KEYS.map(s =>
      `<div class="field"><label>${s.label}</label><input class="input" data-social="${s.key}" placeholder="${attr(s.ph)}" /></div>`).join('');
  }
  function setPreview() { $('#f-photo-preview').src = formPhoto || D.placeholderImage($('#f-name').value || 'Nuevo negocio'); }
  function setLogoPreview() { $('#f-logo-preview').src = formLogo || D.placeholderImage($('#f-name').value || 'Logo'); }
  function renderGallery() {
    $('#f-photos-gallery').innerHTML = formPhotos.map((url, i) =>
      `<div class="pg-thumb"><img src="${attr(url)}" alt="" /><button type="button" class="pg-remove" data-i="${i}" title="Quitar">×</button></div>`).join('')
      + `<button type="button" class="pg-add-tile" id="f-photos-add" title="Añadir fotos">+</button>`;
  }

  async function openDrawer(id) {
    editingId = id || null;
    const b = id ? cache.find(x => x.id === id) : null;
    $('#drawerTitle').textContent = b ? 'Editar negocio' : 'Nuevo negocio';
    ['f-name', 'f-address', 'f-about', 'f-phone', 'f-email', 'f-website', 'f-rating', 'f-reviews'].forEach(k => { $('#' + k).value = ''; });
    $('#f-featured').checked = false;
    $('#f-district').value = '';
    $$('#f-hours [data-day]').forEach(i => { i.value = ''; });
    $$('#f-social [data-social]').forEach(i => { i.value = ''; });
    $$('#f-categories input:checked, #f-metros input:checked').forEach(i => { i.checked = false; });
    $('#f-metro-filter').value = ''; filterMetros('');
    formPhoto = null; formLogo = null; formPhotos = [];
    $('#importSummary').classList.add('hidden');
    await loadBarrios(null);

    if (b) {
      $('#f-name').value = b.name; $('#f-address').value = b.address; $('#f-about').value = b.about;
      $('#f-phone').value = b.phone; $('#f-email').value = b.email; $('#f-website').value = b.website;
      $('#f-rating').value = b.rating != null ? b.rating : ''; $('#f-reviews').value = b.reviews || '';
      $('#f-featured').checked = !!b.featured;
      formPhoto = b.photo || null; formLogo = b.logo || null; formPhotos = Array.isArray(b.photos) ? b.photos.slice() : [];
      (b.categories || []).forEach(c => { const el = $(`#f-categories input[data-cat="${c.id}"]`); if (el) el.checked = true; });
      (b.metros || []).forEach(m => { const el = $(`#f-metros input[data-metro="${m.id}"]`); if (el) el.checked = true; });
      $$('#f-hours [data-day]').forEach(i => { const v = b.hours && b.hours[i.dataset.day]; i.value = (v && v !== 'Cerrado') ? v : ''; });
      $$('#f-social [data-social]').forEach(i => { i.value = (b.social && b.social[i.dataset.social]) || ''; });
      if (b.district) { $('#f-district').value = String(b.district.id); await loadBarrios(b.district.id, b.neighborhood ? b.neighborhood.id : null); }
    }
    setPreview(); setLogoPreview(); renderGallery();
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
    const hours = {}; $$('#f-hours [data-day]').forEach(i => { hours[i.dataset.day] = i.value.trim() || 'Cerrado'; });
    const social = {}; $$('#f-social [data-social]').forEach(i => { if (i.value.trim()) social[i.dataset.social] = i.value.trim(); });
    const rating = parseFloat($('#f-rating').value);
    return {
      name: $('#f-name').value, address: $('#f-address').value, about: $('#f-about').value,
      phone: $('#f-phone').value, email: $('#f-email').value, website: $('#f-website').value,
      rating: isNaN(rating) ? null : Math.min(5, Math.max(0, rating)),
      reviews: parseInt($('#f-reviews').value, 10) || 0,
      featured: $('#f-featured').checked, photo: formPhoto, logo: formLogo, photos: formPhotos, hours, social,
      districtId: $('#f-district').value ? +$('#f-district').value : null,
      neighborhoodId: $('#f-barrio').value ? +$('#f-barrio').value : null,
      categoryIds: $$('#f-categories input:checked').map(i => +i.dataset.cat),
      metroIds: $$('#f-metros input:checked').map(i => +i.dataset.metro),
    };
  }
  async function save() {
    const data = gather();
    if (!data.name.trim()) { toast('El nombre es obligatorio', 'err'); $('#f-name').focus(); return; }
    $('#drawerSave').disabled = true;
    try {
      if (editingId) await api.updateBusiness(editingId, data); else await api.createBusiness(data);
      closeDrawer(); await renderBusinesses();
      toast(editingId ? 'Negocio actualizado' : 'Negocio añadido');
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
    $('#f-district').addEventListener('change', e => loadBarrios(e.target.value ? +e.target.value : null));
    $('#f-metro-filter').addEventListener('input', e => filterMetros(e.target.value));
    $('#f-name').addEventListener('input', () => { if (!formPhoto) setPreview(); if (!formLogo) setLogoPreview(); });
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
    // Logo
    $('#f-logo-btn').addEventListener('click', () => $('#f-logo-input').click());
    $('#f-logo-clear').addEventListener('click', () => { formLogo = null; setLogoPreview(); });
    $('#f-logo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      $('#f-logo-btn').disabled = true;
      try { const dataUrl = await resizeImage(file, 480); const r = await api.upload(dataUrl); formLogo = r.url; setLogoPreview(); toast('Logo subido'); }
      catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo subir el logo', 'err'); }
      finally { $('#f-logo-btn').disabled = false; e.target.value = ''; }
    });
    // Galería de fotos de servicios
    $('#f-photos-gallery').addEventListener('click', e => {
      if (e.target.closest('#f-photos-add')) { $('#f-photos-input').click(); return; }
      const rm = e.target.closest('.pg-remove');
      if (rm) { formPhotos.splice(+rm.dataset.i, 1); renderGallery(); }
    });
    $('#f-photos-input').addEventListener('change', async e => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      for (const file of files) {
        try { const dataUrl = await resizeImage(file, 1000); const r = await api.upload(dataUrl); formPhotos.push(r.url); renderGallery(); }
        catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo subir una foto', 'err'); }
      }
      toast('Fotos actualizadas'); e.target.value = '';
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
      a.href = url; a.download = 'reformas-madrid.json';
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
        const list = Array.isArray(parsed) ? parsed : (parsed.businesses || parsed.clinics);
        if (!Array.isArray(list)) throw new Error('falta "businesses"');
        const r = await api.importData(list);
        await renderBusinesses();
        toast(`Importados ${r.businesses.length} negocios`);
      } catch (err) { toast('Archivo no válido: ' + (err.message || 'error'), 'err'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ----------------------- Importar desde URL --------------------------- */
  const FIELD_LABELS = {
    name: 'Nombre', zone: 'Zona', address: 'Dirección', about: 'Descripción',
    services: 'Servicios', phone: 'Teléfono', email: 'Email', website: 'Web',
    social: 'Redes sociales', hours: 'Horario', photo: 'Logo / Foto', rating: 'Valoración', reviews: 'Reseñas',
  };

  function openImportModal() {
    $('#importUrlInput').value = '';
    $('#importUrlError').classList.add('hidden');
    $('#importUrlProgress').classList.add('hidden');
    $('#importUrlGo').disabled = false;
    $('#importUrlBackdrop').classList.add('open');
    setTimeout(() => $('#importUrlInput').focus(), 60);
  }
  function closeImportModal() { $('#importUrlBackdrop').classList.remove('open'); }

  async function runImport() {
    const url = $('#importUrlInput').value.trim();
    $('#importUrlError').classList.add('hidden');
    if (!/^https?:\/\/.+\..+/.test(url)) {
      $('#importUrlError').textContent = 'Introduce una URL válida (https://…).';
      $('#importUrlError').classList.remove('hidden');
      return;
    }
    $('#importUrlGo').disabled = true;
    $('#importUrlProgress').classList.remove('hidden');
    $('#importUrlProgressText').textContent = 'Analizando el sitio web… (esto puede tardar unos segundos)';
    try {
      const res = await api.extractFromUrl(url);
      closeImportModal();
      await prefillFromExtract(res);
      const n = Object.keys(res.confidence || {}).filter(k => FIELD_LABELS[k]).length;
      toast(`Sitio analizado: ${res.pagesCrawled} páginas · ${n} campos`);
    } catch (e) {
      $('#importUrlProgress').classList.add('hidden');
      $('#importUrlError').textContent = e.status === 401 ? 'Sesión expirada. Vuelve a iniciar sesión.'
        : (e.message || 'No se pudo analizar el sitio web.');
      $('#importUrlError').classList.remove('hidden');
      if (e.status === 401) setTimeout(() => location.replace('login.html'), 1200);
    } finally { $('#importUrlGo').disabled = false; }
  }

  async function prefillFromExtract(res) {
    const f = res.fields || {}, conf = res.confidence || {};
    await openDrawer();
    $('#drawerTitle').textContent = 'Nuevo negocio (importado)';
    const setVal = (id, v) => { if (v != null && v !== '') $('#' + id).value = v; };
    setVal('f-name', f.name); setVal('f-address', f.address); setVal('f-about', f.about);
    setVal('f-phone', f.phone); setVal('f-email', f.email); setVal('f-website', f.website);
    if (f.rating != null) $('#f-rating').value = f.rating;
    if (f.reviews != null) $('#f-reviews').value = f.reviews;

    // Distrito (por slug o por nombre coincidente con la zona detectada)
    let distId = null;
    if (f.districtSlug) { const d = districts.find(x => x.slug === f.districtSlug); if (d) distId = d.id; }
    if (!distId && f.zone) { const d = districts.find(x => norm(x.name) === norm(f.zone)); if (d) distId = d.id; }
    if (distId) {
      $('#f-district').value = String(distId);
      await loadBarrios(distId, null);
      let barId = null;
      if (f.barrioSlug) { const b = (barrioCache[distId] || []).find(x => x.slug === f.barrioSlug); if (b) barId = b.id; }
      if (!barId && f.zone) { const b = (barrioCache[distId] || []).find(x => norm(x.name) === norm(f.zone)); if (b) barId = b.id; }
      if (barId) $('#f-barrio').value = String(barId);
    }

    // Categorías (por slug del crawler, o por nombre desde services legacy)
    (Array.isArray(f.categorySlugs) ? f.categorySlugs : []).forEach(slug => {
      const c = categoriesFlat.find(x => x.slug === slug); if (c) { const el = $(`#f-categories input[data-cat="${c.id}"]`); if (el) el.checked = true; }
    });
    (Array.isArray(f.services) ? f.services : []).forEach(name => {
      const c = categoriesFlat.find(x => norm(x.name) === norm(name)); if (c) { const el = $(`#f-categories input[data-cat="${c.id}"]`); if (el) el.checked = true; }
    });
    // Metro
    (Array.isArray(f.metroSlugs) ? f.metroSlugs : []).forEach(slug => {
      const m = metros.find(x => x.slug === slug); if (m) { const el = $(`#f-metros input[data-metro="${m.id}"]`); if (el) el.checked = true; }
    });

    $$('#f-hours [data-day]').forEach(i => { const v = f.hours && f.hours[i.dataset.day]; i.value = (v && v !== 'Cerrado') ? v : ''; });
    $$('#f-social [data-social]').forEach(i => { i.value = (f.social && f.social[i.dataset.social]) || ''; });
    formPhoto = f.photo || null; formLogo = f.photo || null; formPhotos = [];
    setPreview(); setLogoPreview(); renderGallery();
    renderImportSummary(conf, res, f);
  }

  function renderImportSummary(conf, res, fields) {
    const box = $('#importSummary');
    const keys = Object.keys(conf).filter(k => FIELD_LABELS[k]);
    const items = keys.map(k => {
      const c = conf[k];
      const lvl = ['alta', 'media', 'baja'].includes(c.level) ? c.level : 'baja';
      return `<li><span class="conf-dot conf-${lvl}"></span><span class="cf-field">${esc(FIELD_LABELS[k])}</span><span class="cf-src">· ${esc(c.via || 'auto')} (${esc(lvl)})</span></li>`;
    }).join('');
    box.innerHTML = `
      <h4>${IC.check} Datos importados — elige zona y categorías, y revisa antes de guardar</h4>
      <p>Rastreadas <b>${res.pagesCrawled}</b> páginas. Confirma el <b>distrito/barrio</b> y marca las <b>categorías</b> correctas; los campos inseguros se dejan vacíos.</p>
      <ul>${items || '<li class="cf-src">No se detectaron datos estructurados.</li>'}</ul>`;
    box.classList.remove('hidden');
  }

  function bindImport() {
    $('#importUrlBtn').addEventListener('click', openImportModal);
    $('#importUrlClose').addEventListener('click', closeImportModal);
    $('#importUrlCancel').addEventListener('click', closeImportModal);
    $('#importUrlBackdrop').addEventListener('click', e => { if (e.target === $('#importUrlBackdrop')) closeImportModal(); });
    $('#importUrlGo').addEventListener('click', runImport);
    $('#importUrlInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runImport(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#importUrlBackdrop').classList.contains('open')) closeImportModal(); });
  }

  /* ----------------------------- Taxonomía ------------------------------ */
  function renderTaxonomy() {
    $('#catList').innerHTML = categoriesTree.map(c => `
      <div class="tax-row tax-row-parent">
        <div class="tax-row-main"><b>${esc(c.name)}</b> <span class="tax-slug">/${esc(c.slug)}</span>${c.in_nav ? '' : ' <span class="pill pill-muted">oculta</span>'}</div>
        <div class="row-actions">
          <button class="icon-btn" data-cact="edit" data-id="${c.id}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-cact="del" data-id="${c.id}" title="Eliminar">${IC.trash}</button>
        </div>
      </div>
      ${(c.children || []).map(s => `
      <div class="tax-row tax-row-child">
        <div class="tax-row-main">${esc(s.name)} <span class="tax-slug">/${esc(s.slug)}</span></div>
        <div class="row-actions">
          <button class="icon-btn" data-cact="edit" data-id="${s.id}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-cact="del" data-id="${s.id}" title="Eliminar">${IC.trash}</button>
        </div>
      </div>`).join('')}`).join('');

    $('#metroList').innerHTML = metros.map(m => `
      <div class="tax-row">
        <div class="tax-row-main">${esc(m.name)}${m.lines && m.lines.length ? ` <span class="ml-lines">L${m.lines.join(' · L')}</span>` : ''} <span class="tax-slug">/${esc(m.slug)}</span></div>
        <div class="row-actions">
          <button class="icon-btn" data-mact="edit" data-id="${m.id}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-mact="del" data-id="${m.id}" title="Eliminar">${IC.trash}</button>
        </div>
      </div>`).join('');
  }

  async function refreshTaxonomyEverywhere() {
    await loadTaxonomy();
    fillDistrictSelects(); buildCategoryChecklist(); buildMetroChecklist(); renderTaxonomy();
  }

  /* --- Category modal --- */
  function openCatModal(id) {
    const c = id ? categoriesFlat.find(x => x.id === id) : null;
    $('#catModalTitle').textContent = c ? 'Editar categoría' : 'Nueva categoría';
    $('#cat-id').value = c ? c.id : '';
    $('#cat-name').value = c ? c.name : '';
    $('#cat-intro').value = c ? c.intro : '';
    $('#cat-innav').checked = c ? !!c.in_nav : true;
    const parentOpts = '<option value="">— Ninguna (principal, en el menú) —</option>' +
      categoriesTree.filter(t => !c || t.id !== c.id).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    $('#cat-parent').innerHTML = parentOpts;
    $('#cat-parent').value = c && c.parent_id ? String(c.parent_id) : '';
    $('#catError').classList.add('hidden');
    $('#catBackdrop').classList.add('open');
    setTimeout(() => $('#cat-name').focus(), 60);
  }
  function closeCatModal() { $('#catBackdrop').classList.remove('open'); }
  async function saveCat() {
    const id = $('#cat-id').value;
    const payload = { name: $('#cat-name').value.trim(), parentId: $('#cat-parent').value || null, intro: $('#cat-intro').value.trim(), in_nav: $('#cat-innav').checked ? 1 : 0 };
    if (!payload.name) { $('#catError').textContent = 'El nombre es obligatorio.'; $('#catError').classList.remove('hidden'); return; }
    $('#catSave').disabled = true;
    try {
      if (id) await api.updateCategory(+id, payload); else await api.createCategory(payload);
      closeCatModal(); await refreshTaxonomyEverywhere(); toast(id ? 'Categoría actualizada' : 'Categoría creada');
    } catch (e) { $('#catError').textContent = e.message || 'No se pudo guardar.'; $('#catError').classList.remove('hidden'); }
    finally { $('#catSave').disabled = false; }
  }

  /* --- Metro modal --- */
  function openMetroModal(id) {
    const m = id ? metros.find(x => x.id === id) : null;
    $('#metroModalTitle').textContent = m ? 'Editar estación' : 'Nueva estación';
    $('#metro-id').value = m ? m.id : '';
    $('#metro-name').value = m ? m.name : '';
    $('#metro-lines').value = m && m.lines ? m.lines.join(', ') : '';
    $('#metroError').classList.add('hidden');
    $('#metroBackdrop').classList.add('open');
    setTimeout(() => $('#metro-name').focus(), 60);
  }
  function closeMetroModal() { $('#metroBackdrop').classList.remove('open'); }
  async function saveMetro() {
    const id = $('#metro-id').value;
    const payload = { name: $('#metro-name').value.trim(), lines: $('#metro-lines').value };
    if (!payload.name) { $('#metroError').textContent = 'El nombre es obligatorio.'; $('#metroError').classList.remove('hidden'); return; }
    $('#metroSave').disabled = true;
    try {
      if (id) await api.updateMetro(+id, payload); else await api.createMetro(payload);
      closeMetroModal(); await refreshTaxonomyEverywhere(); toast(id ? 'Estación actualizada' : 'Estación creada');
    } catch (e) { $('#metroError').textContent = e.message || 'No se pudo guardar.'; $('#metroError').classList.remove('hidden'); }
    finally { $('#metroSave').disabled = false; }
  }

  function bindTaxonomy() {
    $('#newCatBtn').addEventListener('click', () => openCatModal());
    $('#newMetroBtn').addEventListener('click', () => openMetroModal());
    $('#catList').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-cact]'); if (!btn) return;
      const id = +btn.dataset.id;
      if (btn.dataset.cact === 'edit') openCatModal(id);
      else if (confirm('¿Eliminar esta categoría? Se quitará de los negocios y del menú (las subcategorías también).')) {
        try { await api.deleteCategory(id); await refreshTaxonomyEverywhere(); toast('Categoría eliminada'); } catch { toast('No se pudo eliminar', 'err'); }
      }
    });
    $('#metroList').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-mact]'); if (!btn) return;
      const id = +btn.dataset.id;
      if (btn.dataset.mact === 'edit') openMetroModal(id);
      else if (confirm('¿Eliminar esta estación de metro?')) {
        try { await api.deleteMetro(id); await refreshTaxonomyEverywhere(); toast('Estación eliminada'); } catch { toast('No se pudo eliminar', 'err'); }
      }
    });
    $('#catSave').addEventListener('click', saveCat);
    $('#catCancel').addEventListener('click', closeCatModal);
    $('#catClose').addEventListener('click', closeCatModal);
    $('#catBackdrop').addEventListener('click', e => { if (e.target === $('#catBackdrop')) closeCatModal(); });
    $('#metroSave').addEventListener('click', saveMetro);
    $('#metroCancel').addEventListener('click', closeMetroModal);
    $('#metroClose').addEventListener('click', closeMetroModal);
    $('#metroBackdrop').addEventListener('click', e => { if (e.target === $('#metroBackdrop')) closeMetroModal(); });
    $('#addBarrioForm').addEventListener('submit', async e => {
      e.preventDefault();
      const districtId = +$('#ab-district').value, name = $('#ab-name').value.trim();
      if (!name) return;
      try { await api.createNeighborhood({ name, districtId }); delete barrioCache[districtId]; $('#ab-name').value = ''; toast('Barrio añadido'); }
      catch (e2) { toast(e2.message || 'No se pudo añadir', 'err'); }
    });
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
        <img class="rank-thumb" src="${attr(bizPhoto(x))}" alt="" />
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

  /* ----------------------- Orden / Clasamentos -------------------------- */
  const ORD_PAGE = 20;
  let ordZones = [], ordInited = false;
  let ordCtx = null, ordItems = [], ordAvailable = [], ordDragId = null;

  function ordResolveContext() {
    const type = $('#ord-type').value;
    if (type === 'home') return 'home';
    const cat = $('#ord-cat').value;
    if (!cat) return null;
    const scope = $('#ord-scope').value;
    if (scope === 'zona') { const z = $('#ord-zona').value; return z ? `cat:${cat}:zona:${z}` : null; }
    if (scope === 'mun') { const m = $('#ord-mun').value; return m ? `cat:${cat}:mun:${m}` : null; }
    return `cat:${cat}`;
  }
  function ordSyncFields() {
    const isCat = $('#ord-type').value === 'cat';
    const scope = $('#ord-scope').value;
    $('#ord-cat-field').style.display = isCat ? '' : 'none';
    $('#ord-scope-field').style.display = isCat ? '' : 'none';
    $('#ord-zona-field').style.display = isCat && scope === 'zona' ? '' : 'none';
    $('#ord-mun-field').style.display = isCat && scope === 'mun' ? '' : 'none';
  }
  function ordFillSelectors() {
    $('#ord-cat').innerHTML = '<option value="">Elige servicio…</option>' + categoriesTree.map(c => `<option value="${attr(c.slug)}">${esc(c.name)}</option>`).join('');
    $('#ord-mun').innerHTML = '<option value="">Elige municipio/distrito…</option>' + districts.map(d => `<option value="${attr(d.slug)}">${esc(d.name)}</option>`).join('');
    $('#ord-zona').innerHTML = '<option value="">Elige zona…</option>' + ordZones.map(z => `<option value="${attr(z.slug)}">${esc(z.name)}</option>`).join('');
  }
  function ordThumb(b) { return attr(b.cover || D.placeholderImage(b.name)); }
  function ordSlot(b, pos) {
    return `<li class="ord-slot" draggable="true" data-id="${attr(b.id)}">
      <span class="ord-pos">${pos + 1}</span>
      <span class="ord-thumb"><img src="${ordThumb(b)}" alt="" /></span>
      <span class="ord-info"><span class="ord-name">${esc(b.name)}${b.featured ? ' ★' : ''}</span><span class="ord-zone">${esc(b.zone || '')}</span></span>
      <span class="ord-slot-actions">
        <button class="icon-btn" data-ord="up" title="Subir">▲</button>
        <button class="icon-btn" data-ord="down" title="Bajar">▼</button>
        ${ordCtx === 'home' ? `<button class="icon-btn danger" data-ord="remove" title="Quitar de destacadas">${IC.trash}</button>` : ''}
      </span>
    </li>`;
  }
  function ordRenderBoard() {
    const board = $('#ord-board');
    if (ordCtx) $('#ord-status').textContent = ordStatusText(ordCtx === 'home' ? 'home' : 'cat');
    if (!ordItems.length) { board.innerHTML = `<div class="ord-empty">No hay empresas en este contexto${ordCtx === 'home' ? '. Añádelas abajo.' : ' todavía.'}</div>`; return; }
    const pages = Math.ceil(ordItems.length / ORD_PAGE);
    let html = '';
    for (let pg = 0; pg < pages; pg++) {
      const slice = ordItems.slice(pg * ORD_PAGE, (pg + 1) * ORD_PAGE);
      html += `<div class="ord-page"><div class="ord-page-head"><b>Página ${pg + 1}</b><span class="ord-page-count">${slice.length} ${slice.length === 1 ? 'empresa' : 'empresas'}</span></div>`;
      html += `<ul class="ord-slots" data-page="${pg}">${slice.map((b, i) => ordSlot(b, pg * ORD_PAGE + i)).join('')}</ul></div>`;
    }
    board.innerHTML = html;
  }
  function ordRenderAdd() {
    const q = norm($('#ord-add-search').value || '');
    const list = ordAvailable.filter(b => !q || norm(b.name).includes(q));
    $('#ord-add-list').innerHTML = list.length
      ? list.slice(0, 120).map(b => `
        <div class="ord-add-row"><span class="ord-thumb"><img src="${ordThumb(b)}" alt=""></span><span class="ord-name">${esc(b.name)}</span><button class="btn btn-soft btn-sm" data-add="${attr(b.id)}">Añadir</button></div>`).join('')
      : '<p class="muted" style="padding:8px 4px">No hay más empresas para añadir.</p>';
  }
  function ordStatusText(kind) {
    if (kind === 'home') return `Empresas destacadas del home — arrastra para ordenar. ${ordItems.length} en la lista · 20 por página.`;
    return `${ordItems.length} ${ordItems.length === 1 ? 'empresa' : 'empresas'} · arrastra para fijar el orden. Por defecto es aleatorio; fijar aquí lo sobrescribe.`;
  }
  async function ordLoad() {
    ordCtx = ordResolveContext();
    const board = $('#ord-board'), status = $('#ord-status'), add = $('#ord-add');
    if (!ordCtx) { board.innerHTML = ''; add.style.display = 'none'; status.textContent = 'Elige servicio, zona o municipio para ver el clasamento.'; return; }
    status.textContent = 'Cargando…';
    try {
      const d = await api.getPlacements(ordCtx);
      ordItems = d.items || []; ordAvailable = d.available || [];
      status.textContent = ordStatusText(d.kind);
      add.style.display = d.kind === 'home' ? '' : 'none';
      ordRenderBoard(); if (d.kind === 'home') ordRenderAdd();
    } catch (e) {
      status.textContent = 'No se pudo cargar el clasamento.';
      if (e.status === 401) location.replace('login.html');
    }
  }
  async function ordSave() {
    if (!ordCtx) return;
    $('#ord-save').disabled = true;
    try { await api.setPlacements(ordCtx, ordItems.map(b => b.id)); toast('Orden guardado'); }
    catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo guardar el orden', 'err'); }
    finally { $('#ord-save').disabled = false; }
  }
  async function ordReset() {
    if (!ordCtx) return;
    if (!confirm('¿Restablecer este contexto a orden aleatorio? Se borrará el orden manual guardado.')) return;
    try { await api.clearPlacements(ordCtx); toast('Restablecido a aleatorio'); await ordLoad(); }
    catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo restablecer', 'err'); }
  }
  function bindOrden() {
    ['ord-type', 'ord-cat', 'ord-scope', 'ord-zona', 'ord-mun'].forEach(id => $('#' + id).addEventListener('change', () => { ordSyncFields(); ordLoad(); }));
    $('#ord-save').addEventListener('click', ordSave);
    $('#ord-reset').addEventListener('click', ordReset);
    $('#ord-add-search').addEventListener('input', ordRenderAdd);
    $('#ord-add-list').addEventListener('click', e => {
      const btn = e.target.closest('button[data-add]'); if (!btn) return;
      const idx = ordAvailable.findIndex(b => b.id === btn.dataset.add); if (idx < 0) return;
      const [b] = ordAvailable.splice(idx, 1);
      ordItems.splice(Math.floor(Math.random() * (ordItems.length + 1)), 0, b); // se populează random
      ordRenderBoard(); ordRenderAdd();
    });
    const board = $('#ord-board');
    board.addEventListener('click', e => {
      const btn = e.target.closest('button[data-ord]'); if (!btn) return;
      const slot = btn.closest('.ord-slot'); const i = ordItems.findIndex(x => x.id === slot.dataset.id); if (i < 0) return;
      const act = btn.dataset.ord;
      if (act === 'up' && i > 0) { const t = ordItems[i - 1]; ordItems[i - 1] = ordItems[i]; ordItems[i] = t; ordRenderBoard(); }
      else if (act === 'down' && i < ordItems.length - 1) { const t = ordItems[i + 1]; ordItems[i + 1] = ordItems[i]; ordItems[i] = t; ordRenderBoard(); }
      else if (act === 'remove') { const [b] = ordItems.splice(i, 1); ordAvailable.unshift(b); ordRenderBoard(); ordRenderAdd(); }
    });
    board.addEventListener('dragstart', e => { const s = e.target.closest('.ord-slot'); if (!s) return; ordDragId = s.dataset.id; s.classList.add('dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; });
    board.addEventListener('dragend', () => { $$('.ord-slot', board).forEach(x => x.classList.remove('dragging', 'drop-target')); ordDragId = null; });
    board.addEventListener('dragover', e => {
      const s = e.target.closest('.ord-slot'); if (!s || !ordDragId) return;
      e.preventDefault();
      $$('.ord-slot.drop-target', board).forEach(x => x.classList.remove('drop-target'));
      s.classList.add('drop-target');
    });
    board.addEventListener('drop', e => {
      const s = e.target.closest('.ord-slot'); if (!s || !ordDragId) return;
      e.preventDefault();
      const targetId = s.dataset.id; if (targetId === ordDragId) return;
      const from = ordItems.findIndex(x => x.id === ordDragId); if (from < 0) return;
      const [moved] = ordItems.splice(from, 1);
      let to = ordItems.findIndex(x => x.id === targetId);
      const rect = s.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) to += 1;
      ordItems.splice(to, 0, moved);
      ordRenderBoard();
    });
  }
  async function ordEnter() {
    if (!ordInited) {
      try { ordZones = await api.zones(); } catch { ordZones = []; }
      ordFillSelectors(); ordSyncFields(); ordInited = true;
    }
    ordLoad();
  }

  /* --------------------------- View switching --------------------------- */
  function switchView(v) {
    $$('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $('#view-negocios').classList.toggle('hidden', v !== 'negocios');
    $('#view-taxonomia').classList.toggle('hidden', v !== 'taxonomia');
    $('#view-orden').classList.toggle('hidden', v !== 'orden');
    $('#view-stats').classList.toggle('hidden', v !== 'stats');
    if (v === 'stats') renderStats();
    if (v === 'taxonomia') renderTaxonomy();
    if (v === 'orden') ordEnter();
  }

  /* ------------------------------- Boot --------------------------------- */
  async function boot() {
    let me;
    try { me = await api.me(); } catch { me = { user: null }; }
    if (!me.user) { location.replace('login.html'); return; }

    buildHoursEditor(); buildSocialInputs();
    try { await loadTaxonomy(); } catch { toast('No se pudo cargar la taxonomía', 'err'); }
    fillDistrictSelects(); buildCategoryChecklist(); buildMetroChecklist();

    bindBusinesses(); bindDrawer(); bindStats(); bindImport(); bindTaxonomy(); bindOrden();
    $$('.admin-nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('#logoutBtn').addEventListener('click', async e => { e.preventDefault(); try { await api.logout(); } catch {} location.replace('login.html'); });
    $('#adminApp').classList.remove('hidden');
    renderBusinesses();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
