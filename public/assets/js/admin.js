/* =========================================================================
   admin.js — Panel de administración (Profesionales Madrid).
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
  /* Paginat pe server (poate fi vorba de 100k negocios) → cerem o pagină pe rând,
     cu căutare server-side. `cache` ține DOAR pagina curentă (suficient pentru
     editar/eliminar/destacar, care acționează pe rândurile vizibile). */
  let bizPage = 1, bizQuery = '', bizCat = '';
  async function renderBusinesses() {
    let resp;
    try { resp = await api.listBusinessesPage({ page: bizPage, pageSize: 50, q: bizQuery || undefined, category: bizCat || undefined }); }
    catch (e) { toast('No se pudieron cargar los negocios', 'err'); return; }
    const list = resp.businesses || [];
    bizPage = resp.page || 1;
    cache = list;
    const totalTxt = `${fmt(resp.total)} ${resp.total === 1 ? 'negocio' : 'negocios'}${bizQuery || bizCat ? ' (filtrado)' : ' en el directorio'}`;
    $('#bizCount').textContent = resp.pages > 1 ? `${totalTxt} · página ${resp.page} de ${resp.pages}` : totalTxt;
    renderBizPager(resp);
    const rows = $('#bizRows');
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">${bizQuery || bizCat ? 'No hay resultados para la búsqueda.' : 'No hay negocios. <a href="#" id="emptyNew">Añade el primero</a>.'}</td></tr>`;
      const en = $('#emptyNew'); if (en) en.addEventListener('click', e => { e.preventDefault(); openDrawer(); });
      return;
    }
    rows.innerHTML = list.map(b => `
      <tr>
        <td><div class="t-clinic"><img src="${attr(bizPhoto(b))}" alt="" /><div><div class="t-name">${esc(b.name)}</div><div class="t-zone">${esc(b.phone || b.address || '')}</div></div></div></td>
        <td>${esc(b.zone) || '<span class="muted">—</span>'}</td>
        <td>${esc((b.categories || []).filter(c => !c.parent_id).map(c => c.name).join(', ')) || `${(b.categories || []).length} <span class="muted">serv.</span>`}</td>
        <td>${bizReviews(b)}</td>
        <td><div class="t-pills">${b.homePos ? `<span class="pill pill-home" title="Posición en la portada">⌂ Nº ${b.homePos}</span>` : ''}${b.featured ? '<span class="pill pill-gold">★ Patrocinado</span>' : ''}${b.claimed ? '<span class="pill pill-ok">✓ Verificada</span>' : ''}${!b.homePos && !b.featured && !b.claimed ? '<span class="muted">—</span>' : ''}</div></td>
        <td><div class="row-actions">
          <button class="icon-btn home ${b.homePos ? 'on' : ''}" data-act="home" data-id="${attr(b.id)}" title="${b.homePos ? 'Quitar de la portada' : 'Añadir a la portada (al final)'}">${IC.home}</button>
          <button class="icon-btn gold ${b.featured ? 'on' : ''}" data-act="feature" data-id="${attr(b.id)}" title="Destacar">${IC.star}</button>
          <button class="icon-btn" data-act="edit" data-id="${attr(b.id)}" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-act="delete" data-id="${attr(b.id)}" title="Eliminar">${IC.trash}</button>
        </div></td>
      </tr>`).join('');
  }
  function bizPhoto(b) { return (b && (b.logo || b.photo)) || D.placeholderImage(b ? b.name : ''); }
  function bizReviews(b) {
    const parts = [];
    if (b.rating != null) parts.push('★ ' + D.rating1(b.rating));
    if (b.reviews) parts.push(fmt(b.reviews) + (b.rating != null ? '' : ' reseñas'));
    return parts.length ? parts.join(' · ') : '<span class="muted">—</span>';
  }
  function renderBizPager(resp) {
    const el = $('#bizPager'); if (!el) return;
    if (!resp || resp.pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="bizPrev" ${resp.page <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="muted">Página ${resp.page} de ${resp.pages}</span>
      <button class="btn btn-ghost btn-sm" id="bizNext" ${resp.page >= resp.pages ? 'disabled' : ''}>Siguiente →</button>`;
    const prev = $('#bizPrev'), next = $('#bizNext');
    if (prev) prev.addEventListener('click', () => { if (bizPage > 1) { bizPage--; renderBusinesses(); } });
    if (next) next.addEventListener('click', () => { if (bizPage < resp.pages) { bizPage++; renderBusinesses(); } });
  }

  function bindBusinesses() {
    $('#bizRows').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      const b = cache.find(x => x.id === id);
      if (act === 'edit') openDrawer(id);
      else if (act === 'home') {
        const on = !(b && b.homePos);
        try {
          const r = await api.setHome(id, on);
          await renderBusinesses();
          toast(on ? `Añadido a la portada (posición ${r.homePos} de ${r.count})` : 'Quitado de la portada');
        } catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo actualizar la portada', 'err'); }
      }
      else if (act === 'feature') { try { await api.setFeatured(id, !(b && b.featured)); renderBusinesses(); } catch { toast('Error', 'err'); } }
      else if (act === 'delete') {
        if (confirm(`¿Eliminar “${b ? b.name : ''}”? Esta acción no se puede deshacer.`)) {
          try { await api.deleteBusiness(id); renderBusinesses(); toast('Negocio eliminado'); } catch { toast('No se pudo eliminar', 'err'); }
        }
      }
    });
    $('#newBtn').addEventListener('click', () => openDrawer());
    $('#bizCat').addEventListener('change', e => { bizCat = e.target.value; bizPage = 1; renderBusinesses(); });
    const searchEl = $('#bizSearch');
    if (searchEl) {
      let t;
      searchEl.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { bizQuery = searchEl.value.trim(); bizPage = 1; renderBusinesses(); }, 300);
      });
    }
    $('#exportBtn').addEventListener('click', doExport);
    $('#importBtn').addEventListener('click', () => $('#importInput').click());
    $('#importInput').addEventListener('change', doImport);
    $('#resetBtn').addEventListener('click', async () => {
      const n = ($('#bizCount').textContent.match(/^[\d.]+/) || [''])[0];
      if (confirm(`¿Restaurar los negocios de demostración?\n\nSe BORRARÁN todos los negocios actuales${n ? ` (${n})` : ''}, incluidos los importados, y quedarán solo los de demo.`)) {
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
    ['f-name', 'f-contact', 'f-team', 'f-area', 'f-address', 'f-about', 'f-phone', 'f-email', 'f-website', 'f-rating', 'f-reviews'].forEach(k => { $('#' + k).value = ''; });
    $('#f-featured').checked = false;
    $('#f-claimed').checked = false;
    $('#f-badge-wrap').classList.add('hidden');
    $('#f-home').checked = !!(b && b.homePos);
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
      $('#f-contact').value = b.contact_name || ''; $('#f-team').value = b.team_size || ''; $('#f-area').value = b.area || '';
      $('#f-phone').value = b.phone; $('#f-email').value = b.email; $('#f-website').value = b.website;
      $('#f-rating').value = b.rating != null ? b.rating : ''; $('#f-reviews').value = b.reviews || '';
      $('#f-featured').checked = !!b.featured;
      $('#f-claimed').checked = !!b.claimed;
      if (b.claimed) { $('#f-badge').value = badgeCode(b); $('#f-badge-wrap').classList.remove('hidden'); }
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
  /* Código de la insignia «Verificado» para la web del negocio (enlaza a su ficha). */
  function badgeCode(b) {
    const o = location.origin;
    const t = String(b.name || '').replace(/"/g, '&quot;');
    return `<a href="${o}/negocio/${b.id}" title="${t} en Profesionales Madrid"><img src="${o}/insignia/${encodeURIComponent(b.id)}.svg" alt="Verificado en Profesionales Madrid" width="236" height="64"></a>`;
  }
  /* «Crear ficha» desde una solicitud de alta: abre el editor con sus datos. */
  async function openDrawerFromLead(l) {
    await openDrawer(null);
    const p = l.payload || {};
    $('#f-name').value = p.negocio || '';
    $('#f-phone').value = l.phone || '';
    $('#f-website').value = p.web || '';
    $('#f-contact').value = l.name || '';
    $('#f-area').value = p.zona || '';
    $('#f-claimed').checked = true;
    const cat = categoriesFlat.find(c => c.name === p.oficio);
    if (cat) { const el = $(`#f-categories input[data-cat="${cat.id}"]`); if (el) el.checked = true; }
    setPreview(); setLogoPreview();
    toast('Revisa los datos, elige el distrito y guarda');
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
      contact_name: $('#f-contact').value.trim(), team_size: parseInt($('#f-team').value, 10) || null,
      area: $('#f-area').value.trim(),
      phone: $('#f-phone').value, email: $('#f-email').value, website: $('#f-website').value,
      rating: isNaN(rating) ? null : Math.min(5, Math.max(0, rating)),
      reviews: parseInt($('#f-reviews').value, 10) || 0,
      featured: $('#f-featured').checked, claimed: $('#f-claimed').checked,
      photo: formPhoto, logo: formLogo, photos: formPhotos, hours, social,
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
      const saved = editingId ? await api.updateBusiness(editingId, data) : await api.createBusiness(data);
      const prev = editingId ? cache.find(x => x.id === editingId) : null;
      const wantHome = $('#f-home').checked;
      if (saved && saved.id && wantHome !== !!(prev && prev.homePos)) await api.setHome(saved.id, wantHome);
      closeDrawer(); await renderBusinesses();
      toast(editingId ? 'Negocio actualizado' : 'Negocio añadido');
    } catch (e) {
      toast(e.status === 401 ? 'Sesión expirada' : ('No se pudo guardar: ' + (e.message || '')), 'err');
      if (e.status === 401) setTimeout(() => location.replace('login.html'), 800);
    } finally { $('#drawerSave').disabled = false; }
  }

  function bindDrawer() {
    $('#drawerSave').addEventListener('click', save);
    $('#f-badge-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#f-badge').value); toast('Código copiado'); }
      catch { $('#f-badge').select(); document.execCommand('copy'); toast('Código copiado'); }
    });
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
      a.href = url; a.download = 'profesionales-madrid.json';
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

  function fillBizCatFilter() {
    const sel = $('#bizCat'); if (!sel) return;
    sel.innerHTML = '<option value="">Todos los servicios</option>' + categoriesTree.map(c => `<option value="${attr(c.slug)}">${esc(c.name)}</option>`).join('');
    sel.value = bizCat;
  }
  async function refreshTaxonomyEverywhere() {
    await loadTaxonomy();
    fillDistrictSelects(); buildCategoryChecklist(); buildMetroChecklist(); renderTaxonomy(); fillBizCatFilter();
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
    if (s.disabled) {
      $('#statRow').innerHTML = '<p class="muted">En producción las visitas no se guardan en la base de datos: se miden con Plausible o Google Analytics (variables PLAUSIBLE_DOMAIN o GA4_ID). Los clics de llamada y web llegan allí como eventos «click_phone» y «click_web».</p>';
      $('#chart').innerHTML = ''; $('#topList').innerHTML = '';
      return;
    }
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

  /* ------------------------------- Leads -------------------------------- */
  let leadStatus = '', leadKind = '';
  const leadMap = new Map();
  const LEAD_LABEL = { new: 'Nuevo', contacted: 'Contactado', archived: 'Archivado' };
  const KIND_LABEL = { quote: 'Presupuesto', claim: 'Reclamación de ficha', alta: 'Alta de negocio', historia: 'Historia', contacto: 'Contacto' };
  const PAYLOAD_LABEL = {
    cargo: 'Relación', descripcion: 'Descripción', servicios: 'Servicios', zonas: 'Zonas', horario: 'Horario',
    web: 'Web', titular: 'Titular confirmado', negocio: 'Negocio', oficio: 'Servicio', zona: 'Zona', porque: 'Por qué', motivo: 'Motivo',
  };
  function leadTimeAgo(ts) {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - (Number(ts) || 0));
    if (s < 60) return 'ahora';
    const m = Math.floor(s / 60); if (m < 60) return 'hace ' + m + ' min';
    const h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h';
    const d = Math.floor(h / 24); if (d < 30) return 'hace ' + d + ' d';
    return new Date((Number(ts) || 0) * 1000).toLocaleDateString('es-ES');
  }
  function updateLeadBadge(counts) {
    const el = $('#leadsBadge'); if (!el) return;
    const n = (counts && counts.new) || 0;
    el.textContent = n;
    el.classList.toggle('hidden', !n);
  }
  async function refreshLeadBadge() {
    try { const d = await api.leads('new'); updateLeadBadge(d.counts); } catch { /* ignoră */ }
  }
  function leadCard(l) {
    const contact = [
      l.phone ? `<a href="tel:${attr(l.phone)}">${IC.phone}${esc(l.phone)}</a>` : '',
      l.email ? `<a href="mailto:${attr(l.email)}">${IC.mail}${esc(l.email)}</a>` : '',
    ].filter(Boolean).join('');
    const meta = [
      l.businessName ? `Negocio: <a href="/negocio/${attr(l.business_id)}" target="_blank" rel="noopener">${esc(l.businessName)}</a>` : '',
      l.context ? esc(l.context) : '',
    ].filter(Boolean).join(' · ');
    const pl = l.payload && Object.keys(l.payload).length
      ? `<dl class="lead-payload">${Object.entries(l.payload).map(([k, v]) => `<dt>${esc(PAYLOAD_LABEL[k] || k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
    const kind = l.kind || 'quote';
    return `<div class="lead-item lead-status-${attr(l.status)} lead-kind-${attr(kind)}" data-id="${attr(l.id)}">
        <div class="lead-item-main">
          <div class="lead-item-top">
            <span class="lead-kind">${esc(KIND_LABEL[kind] || kind)}</span>
            <span class="lead-name">${esc(l.name)}</span>
            <span class="lead-badge lead-badge-${attr(l.status)}">${esc(LEAD_LABEL[l.status] || l.status)}</span>
            <span class="lead-time">${esc(leadTimeAgo(l.created_at))}</span>
          </div>
          ${contact ? `<div class="lead-contact">${contact}</div>` : ''}
          ${l.message ? `<p class="lead-msg">${esc(l.message)}</p>` : ''}
          ${pl}
          ${meta ? `<div class="lead-meta">${meta}</div>` : ''}
        </div>
        <div class="lead-item-actions">
          ${kind === 'claim' && l.status !== 'contacted' ? `<button class="btn btn-primary btn-sm" data-act="approve" title="Tras llamar al teléfono de la ficha">${IC.check} Aprobar y publicar</button>` : ''}
          ${kind === 'alta' ? `<button class="btn btn-primary btn-sm" data-act="create">Crear ficha</button>` : ''}
          ${l.status !== 'contacted' ? `<button class="btn btn-soft btn-sm" data-act="contacted">${IC.check} Contactado</button>` : ''}
          ${l.status !== 'archived' ? `<button class="btn btn-ghost btn-sm" data-act="archived">Archivar</button>` : ''}
          ${l.status !== 'new' ? `<button class="btn btn-ghost btn-sm" data-act="new">Reabrir</button>` : ''}
          <button class="btn btn-ghost btn-sm lead-del" data-act="delete" title="Eliminar">${IC.trash}</button>
        </div>
      </div>`;
  }
  async function renderLeads() {
    const list = $('#leadList');
    let d;
    try { d = await api.leads(leadStatus, leadKind); }
    catch (e) { if (e.status === 401) return location.replace('login.html'); list.innerHTML = '<p class="muted">No se pudieron cargar los leads.</p>'; return; }
    const c = d.counts || { new: 0, contacted: 0, archived: 0, total: 0 };
    updateLeadBadge(c);
    $$('[data-kind-count]').forEach(el => { const n = (c.kinds || {})[el.dataset.kindCount] || 0; el.textContent = n ? n : ''; });
    leadMap.clear(); (d.leads || []).forEach(l => leadMap.set(l.id, l));
    $('#leadCounts').innerHTML =
      statCard('teal', IC.card, c.total, 'Total') +
      statCard('blue', IC.users, c.new, 'Nuevos') +
      statCard('gold', IC.check, c.contacted, 'Contactados') +
      statCard('pink', IC.trash, c.archived, 'Archivados');
    if (!d.leads.length) {
      list.innerHTML = '<p class="muted" style="padding:10px 2px">' + (leadStatus || leadKind ? 'No hay leads con este filtro.' : 'No hay leads todavía. Cuando un visitante pida presupuesto o un negocio reclame su ficha, aparecerá aquí.') + '</p>';
      return;
    }
    list.innerHTML = d.leads.map(leadCard).join('');
  }
  function bindLeads() {
    $('#leadFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-status]'); if (!b) return;
      leadStatus = b.dataset.status || '';
      $$('#leadFilter [data-status]').forEach(x => {
        const on = x === b;
        x.classList.toggle('is-active', on);
        x.classList.toggle('btn-soft', on);
        x.classList.toggle('btn-ghost', !on);
      });
      renderLeads();
    });
    $('#leadKindFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-kind]'); if (!b) return;
      leadKind = b.dataset.kind || '';
      $$('#leadKindFilter [data-kind]').forEach(x => {
        const on = x === b;
        x.classList.toggle('is-active', on);
        x.classList.toggle('btn-soft', on);
        x.classList.toggle('btn-ghost', !on);
      });
      renderLeads();
    });
    $('#leadList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const item = btn.closest('.lead-item'); const id = item && item.dataset.id; if (!id) return;
      const act = btn.dataset.act;
      if (act === 'create') { const l = leadMap.get(id); if (l) openDrawerFromLead(l); return; }
      try {
        if (act === 'approve') {
          if (!confirm('¿Has llamado al teléfono de la ficha y has confirmado que es el titular? Se publicará su descripción y la ficha quedará verificada.')) return;
          await api.approveClaim(id); toast('Ficha verificada y publicada');
        }
        else if (act === 'delete') { if (!confirm('¿Eliminar este lead? No se puede deshacer.')) return; await api.deleteLead(id); toast('Lead eliminado'); }
        else { await api.setLeadStatus(id, act); toast('Lead actualizado'); }
        renderLeads();
      } catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo actualizar', 'err'); }
    });
  }

  /* ------------------------------ Historias ------------------------------ */
  /* Editor de «Historias de profesionales»: negocio, título, resumen, texto en
     Markdown (con vista previa del servidor), portada y galería, consentimiento
     y patrocinio. Publicar exige consentimiento + resumen + 300 palabras. */
  let stBiz = null, stCover = null, stPhotos = [], stTimer = null;
  const wordsOf = t => String(t || '').split(/\s+/).filter(Boolean).length;
  async function renderStories() {
    const list = $('#storyList');
    let stories;
    try { stories = await api.stories(); }
    catch (e) { if (e.status === 401) return location.replace('login.html'); list.innerHTML = '<p class="muted">No se pudieron cargar las historias.</p>'; return; }
    if (!stories.length) { list.innerHTML = '<p class="muted" style="padding:10px 2px">Aún no hay historias. Pulsa «Nueva historia» para escribir la primera.</p>'; return; }
    list.innerHTML = `<table class="admin-table"><thead><tr><th>Título</th><th>Negocio</th><th>Estado</th><th>Palabras</th><th>Actualizada</th><th></th></tr></thead><tbody>${stories.map(st => `
      <tr data-id="${attr(st.id)}">
        <td><b>${esc(st.title)}</b>${st.sponsored ? ' <span class="pill pill-gold">Patrocinado</span>' : ''}</td>
        <td>${st.businessName ? esc(st.businessName) + (st.businessClaimed ? ' <span class="pill pill-ok">✓</span>' : '') : '<span class="muted">—</span>'}</td>
        <td>${st.status === 'published' ? '<span class="pill pill-ok">Publicada</span>' : '<span class="pill">Borrador</span>'}</td>
        <td>${fmt(wordsOf(st.body))}</td>
        <td class="muted">${st.updated_at ? new Date(st.updated_at * 1000).toLocaleDateString('es-ES') : ''}</td>
        <td><div class="row-actions">
          ${st.status === 'published' ? `<a class="icon-btn" href="/historias/${attr(st.id)}" target="_blank" rel="noopener" title="Ver">${IC.eye}</a>` : ''}
          <button class="icon-btn" data-act="edit" title="Editar">${IC.edit}</button>
          <button class="icon-btn danger" data-act="delete" title="Eliminar">${IC.trash}</button>
        </div></td>
      </tr>`).join('')}</tbody></table>`;
  }
  function stSetBiz(b) {
    stBiz = b ? { id: b.id, name: b.name, claimed: !!b.claimed, zone: b.zone || '' } : null;
    const sel = $('#st-biz-sel');
    if (stBiz) {
      sel.innerHTML = `<b>${esc(stBiz.name)}</b> <span class="muted">${esc(stBiz.zone)}</span> ${stBiz.claimed ? '<span class="pill pill-ok">✓ Verificada</span>' : '<span class="pill pill-gold">Sin verificar</span>'} <button type="button" class="btn btn-ghost btn-sm" id="st-biz-clear">Cambiar</button>`;
      sel.classList.remove('hidden'); $('#st-biz-q').classList.add('hidden');
    } else {
      sel.classList.add('hidden'); sel.innerHTML = ''; $('#st-biz-q').classList.remove('hidden'); $('#st-biz-q').value = '';
    }
    stWarn();
  }
  function stWarn() {
    const w = $('#st-warn');
    const msgs = [];
    if (stBiz && !stBiz.claimed) msgs.push('El negocio aún no está verificado. Antes de publicar, verifica la ficha (la entrevista sirve como verificación).');
    if ($('#st-status').value === 'published' && !$('#st-consent').checked) msgs.push('Para publicar hace falta el consentimiento del negocio.');
    w.innerHTML = msgs.map(esc).join('<br>');
    w.classList.toggle('hidden', !msgs.length);
  }
  function stRenderPhotos() {
    $('#st-photos').innerHTML = stPhotos.map((url, i) => `<div class="pg-thumb"><img src="${attr(url)}" alt="" /><button type="button" class="pg-remove" data-i="${i}" title="Quitar">×</button></div>`).join('')
      + '<button type="button" class="pg-add-tile" id="st-photos-add" title="Añadir fotos">+</button>';
  }
  function stSetCover(url) {
    stCover = url || null;
    const img = $('#st-cover-preview');
    if (stCover) { img.src = stCover; img.classList.remove('hidden'); } else { img.removeAttribute('src'); img.classList.add('hidden'); }
  }
  function stCounts() {
    $('#st-words').textContent = fmt(wordsOf($('#st-body').value));
    $('#st-excerpt-n').textContent = $('#st-excerpt').value.length;
  }
  async function openStory(id) {
    let st = null;
    if (id) { try { st = await api.getStory(id); } catch { toast('No se pudo abrir la historia', 'err'); return; } }
    $('#storyModalTitle').textContent = st ? 'Editar historia' : 'Nueva historia';
    $('#st-id').value = st ? st.id : '';
    $('#st-title').value = st ? st.title : '';
    $('#st-slug').value = st ? st.id : '';
    $('#st-slug').disabled = !!st;            // la URL no cambia una vez creada (no romper enlaces)
    $('#st-excerpt').value = st ? st.excerpt : '';
    $('#st-body').value = st ? st.body : '';
    $('#st-consent').checked = !!(st && st.consent_at);
    $('#st-sponsored').checked = !!(st && st.sponsored);
    $('#st-status').value = st ? st.status : 'draft';
    stPhotos = st && Array.isArray(st.photos) ? st.photos.slice() : [];
    stSetCover(st ? st.cover : null);
    stRenderPhotos();
    $('#st-preview').classList.add('hidden'); $('#st-preview').innerHTML = '';
    $('#st-error').classList.add('hidden');
    $('#st-biz-results').classList.add('hidden');
    stSetBiz(null);
    if (st && st.business_id) {
      try { stSetBiz(await api.getBusiness(st.business_id)); } catch { /* negocio borrado */ }
    }
    $('#st-delete').classList.toggle('hidden', !st);
    const view = $('#st-view');
    view.classList.toggle('hidden', !(st && st.status === 'published'));
    if (st) view.href = '/historias/' + st.id;
    stCounts(); stWarn();
    $('#storyBackdrop').classList.add('open');
    setTimeout(() => $('#st-title').focus({ preventScroll: true }), 60);
  }
  function closeStory() { $('#storyBackdrop').classList.remove('open'); }
  async function saveStory() {
    const id = $('#st-id').value;
    const data = {
      business_id: stBiz ? stBiz.id : null,
      title: $('#st-title').value.trim(), excerpt: $('#st-excerpt').value.trim(), body: $('#st-body').value,
      cover: stCover, photos: stPhotos, status: $('#st-status').value,
      consent: $('#st-consent').checked, sponsored: $('#st-sponsored').checked,
    };
    if (!id && $('#st-slug').value.trim()) data.slug = $('#st-slug').value.trim();
    const errEl = $('#st-error');
    errEl.classList.add('hidden');
    $('#st-save').disabled = true;
    try {
      if (id) await api.updateStory(id, data); else await api.createStory(data);
      closeStory(); renderStories();
      toast(data.status === 'published' ? 'Historia publicada' : 'Borrador guardado');
    } catch (e) {
      errEl.textContent = e.message || 'No se pudo guardar'; errEl.classList.remove('hidden');
    } finally { $('#st-save').disabled = false; }
  }
  function bindStories() {
    $('#storyNew').addEventListener('click', () => openStory(null));
    $('#storyClose').addEventListener('click', closeStory);
    $('#st-cancel').addEventListener('click', closeStory);
    $('#st-save').addEventListener('click', saveStory);
    $('#storyBackdrop').addEventListener('click', e => { if (e.target.id === 'storyBackdrop') closeStory(); });
    $('#storyList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const id = btn.closest('tr').dataset.id;
      if (btn.dataset.act === 'edit') openStory(id);
      if (btn.dataset.act === 'delete') {
        if (!confirm('¿Eliminar esta historia? Si estaba publicada, su URL dejará de existir.')) return;
        try { await api.deleteStory(id); toast('Historia eliminada'); renderStories(); } catch { toast('No se pudo eliminar', 'err'); }
      }
    });
    $('#st-delete').addEventListener('click', async () => {
      const id = $('#st-id').value; if (!id) return;
      if (!confirm('¿Eliminar esta historia? Si estaba publicada, su URL dejará de existir.')) return;
      try { await api.deleteStory(id); closeStory(); toast('Historia eliminada'); renderStories(); } catch { toast('No se pudo eliminar', 'err'); }
    });
    // Buscador de negocio
    $('#st-biz-q').addEventListener('input', e => {
      clearTimeout(stTimer);
      const q = e.target.value.trim();
      const box = $('#st-biz-results');
      if (q.length < 2) { box.classList.add('hidden'); return; }
      stTimer = setTimeout(async () => {
        try {
          const r = await api.listBusinessesPage({ q, pageSize: 8 });
          box.innerHTML = (r.businesses || []).map(b => `<button type="button" data-id="${attr(b.id)}"><b>${esc(b.name)}</b><span>${esc(b.zone || '')}${b.claimed ? ' · ✓' : ''}</span></button>`).join('') || '<p class="muted">Sin resultados</p>';
          box._list = r.businesses || [];
          box.classList.remove('hidden');
        } catch { box.classList.add('hidden'); }
      }, 250);
    });
    $('#st-biz-results').addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const box = $('#st-biz-results');
      stSetBiz((box._list || []).find(x => x.id === b.dataset.id));
      box.classList.add('hidden');
    });
    $('#st-biz-sel').addEventListener('click', e => { if (e.target.id === 'st-biz-clear') stSetBiz(null); });
    // Contadores y avisos
    $('#st-body').addEventListener('input', stCounts);
    $('#st-excerpt').addEventListener('input', stCounts);
    $('#st-status').addEventListener('change', stWarn);
    $('#st-consent').addEventListener('change', stWarn);
    // Vista previa (render del servidor = igual que en la web)
    $('#st-preview-btn').addEventListener('click', async () => {
      const box = $('#st-preview');
      try {
        const r = await api.storyPreview({ body: $('#st-body').value, business_id: stBiz ? stBiz.id : null, sponsored: $('#st-sponsored').checked });
        box.innerHTML = r.html || '<p class="muted">Sin texto.</p>'; box.classList.remove('hidden');
      } catch { toast('No se pudo generar la vista previa', 'err'); }
    });
    // Portada y galería (se reducen en el navegador antes de subir)
    $('#st-cover-btn').addEventListener('click', () => $('#st-cover-input').click());
    $('#st-cover-clear').addEventListener('click', () => stSetCover(null));
    $('#st-cover-input').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      $('#st-cover-btn').disabled = true;
      try { const r = await api.upload(await resizeImage(file, 1600)); stSetCover(r.url); toast('Portada subida'); }
      catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo subir la portada', 'err'); }
      finally { $('#st-cover-btn').disabled = false; e.target.value = ''; }
    });
    $('#st-photos').addEventListener('click', e => {
      if (e.target.closest('#st-photos-add')) { $('#st-photos-input').click(); return; }
      const rm = e.target.closest('.pg-remove');
      if (rm) { stPhotos.splice(+rm.dataset.i, 1); stRenderPhotos(); }
    });
    $('#st-photos-input').addEventListener('change', async e => {
      for (const file of Array.from(e.target.files || [])) {
        try { const r = await api.upload(await resizeImage(file, 1400)); stPhotos.push(r.url); stRenderPhotos(); }
        catch (err) { toast(err.status === 401 ? 'Sesión expirada' : 'No se pudo subir una foto', 'err'); }
      }
      e.target.value = '';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#storyBackdrop').classList.contains('open')) closeStory(); });
  }

  /* ----------------------- Orden / Clasamentos -------------------------- */
  /* Două moduri:
     • „home"  — lista de Empresas destacadas (doar cele alese), pagini de 20.
     • „slots" — o nișă (± zonă/municipio): TOATE firmele, exact ca pe site (20 pe
       pagină). Poziții FIXE absolute: firma fixată pe nr. 45 stă pe pagina 3, iar
       golurile se umplu automat cu restul (ordine aleatorie stabilă). */
  const ORD_PAGE = 20;
  let ordZones = [], ordInited = false;
  let ordCtx = null, ordKind = null, ordDirty = false, ordDragId = null;
  let ordItems = [], ordAvailable = [];                       // home
  let slotAll = [], slotInfo = new Map(), slotPins = new Map(), slotPage = 1;   // slots (pins: id → poziție 1-based)

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
  function ordCtxLabel() {
    if (ordCtx === 'home') return 'Empresas destacadas';
    const cat = categoriesTree.find(c => c.slug === $('#ord-cat').value);
    const scope = $('#ord-scope').value;
    let where = 'toda la Comunidad';
    if (scope === 'zona') { const z = ordZones.find(x => x.slug === $('#ord-zona').value); if (z) where = 'zona ' + z.name; }
    if (scope === 'mun') { const d = districts.find(x => x.slug === $('#ord-mun').value); if (d) where = d.name; }
    return `${cat ? cat.name : ''} · ${where}`;
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
  function ordThumb(cover, name) { return attr(cover || D.placeholderImage(name)); }
  function ordSetDirty(v) {
    ordDirty = v;
    $('#ord-save').textContent = v ? 'Guardar orden •' : 'Guardar orden';
    $('#ord-save').classList.toggle('is-dirty', v);
  }
  const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || lo));

  /* ------------------------------ Modo slots ------------------------------ */
  /* Ordinea publică = fixările pe slotul lor + restul (ordinea automată) în goluri.
     Identic cu orderByContext de pe server. */
  function slotOrder() {
    const pinned = [...slotPins.entries()].filter(([id]) => slotInfo.has(id)).sort((a, b) => a[1] - b[1]);
    const rest = slotAll.filter(b => !slotPins.has(b.id)).map(b => b.id);
    const out = []; let ri = 0;
    for (const [id, pos] of pinned) {
      while (out.length < pos - 1 && ri < rest.length) out.push(rest[ri++]);
      out.push(id);
    }
    while (ri < rest.length) out.push(rest[ri++]);
    return out;
  }
  /* Mută o firmă pe poziția `pos` (1-based) și o fixează acolo. Dacă pe slotul
     respectiv stă altă firmă fixată, schimbă locurile (ia vechiul loc). */
  function slotMoveTo(id, pos) {
    const order = slotOrder();
    pos = clampInt(pos, 1, Math.max(1, order.length));
    const cur = order.indexOf(id) + 1;
    if (slotPins.get(id) === pos && cur === pos) return false;
    for (const [oid, p] of slotPins) if (oid !== id && p === pos) { slotPins.set(oid, cur || pos + 1); break; }
    slotPins.set(id, pos);
    ordSetDirty(true);
    return true;
  }
  function slotFirstFree(page) {
    const order = slotOrder(), from = (page - 1) * ORD_PAGE;
    for (let i = from; i < Math.min(order.length, from + ORD_PAGE); i++) if (!slotPins.has(order[i])) return i + 1;
    return from + 1;
  }
  function slotRow(id, pos) {
    const b = slotInfo.get(id) || { n: id, z: '', r: 0 };
    const pinned = slotPins.has(id);
    return `<li class="ord-slot ${pinned ? 'is-pinned' : 'is-auto'}" draggable="true" data-id="${attr(id)}" data-pos="${pos}">
      <span class="ord-grip" aria-hidden="true" title="Arrastra a otra posición">⠿</span>
      <input class="ord-pos-input" type="number" min="1" value="${pos}" data-ordpos title="Escribe la posición (nº) y pulsa Enter" aria-label="Posición" />
      <span class="ord-thumb"><img src="${ordThumb(b.c, b.n)}" alt="" loading="lazy" /></span>
      <span class="ord-info"><span class="ord-name">${esc(b.n)}</span><span class="ord-zone">${esc(b.z || '')}${b.r ? ` · ${fmt(b.r)} reseñas` : ''}</span></span>
      <span class="ord-badge ${pinned ? 'pin' : 'auto'}">${pinned ? 'Fijada' : 'Automática'}</span>
      <span class="ord-slot-actions">
        ${pinned
          ? `<button class="icon-btn" data-ord="up" title="Subir una posición">▲</button><button class="icon-btn" data-ord="down" title="Bajar una posición">▼</button><button class="icon-btn danger" data-ord="unpin" title="Soltar (vuelve al orden automático)">✕</button>`
          : `<button class="btn btn-soft btn-sm" data-ord="pin" title="Fijar esta empresa en esta posición">Fijar aquí</button>`}
      </span>
    </li>`;
  }
  function slotPagerHtml(pages) {
    const pinPages = new Map();
    slotOrder().forEach((id, i) => { if (slotPins.has(id)) { const pg = Math.floor(i / ORD_PAGE) + 1; pinPages.set(pg, (pinPages.get(pg) || 0) + 1); } });
    const opts = Array.from({ length: pages }, (_, i) => `<option value="${i + 1}"${i + 1 === slotPage ? ' selected' : ''}>${i + 1}${pinPages.has(i + 1) ? ' •' : ''}</option>`).join('');
    const chips = [...pinPages.entries()].sort((a, b) => a[0] - b[0]).map(([pg, n]) => `<button class="chip${pg === slotPage ? ' is-on' : ''}" data-goto="${pg}">Pág. ${pg} · ${n} ${n === 1 ? 'fijada' : 'fijadas'}</button>`).join('');
    return `<div class="ord-pager-nav">
        <button class="btn btn-ghost btn-sm" data-goto="${slotPage - 1}" ${slotPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <label>Página <select class="input" data-pagesel>${opts}</select> de ${pages}</label>
        <button class="btn btn-ghost btn-sm" data-goto="${slotPage + 1}" ${slotPage >= pages ? 'disabled' : ''}>Siguiente →</button>
      </div>
      ${chips ? `<div class="ord-pin-pages"><span class="muted">Con posiciones fijadas:</span>${chips}</div>` : ''}`;
  }
  function slotRender() {
    const order = slotOrder();
    const total = order.length, pages = Math.max(1, Math.ceil(total / ORD_PAGE));
    slotPage = clampInt(slotPage, 1, pages);
    const pinCount = [...slotPins.keys()].filter(id => slotInfo.has(id)).length;
    $('#ord-status').innerHTML = `<b>${esc(ordCtxLabel())}</b>: ${fmt(total)} ${total === 1 ? 'empresa' : 'empresas'} · ${pages} ${pages === 1 ? 'página' : 'páginas'} de 20 en la web. `
      + `<b>${pinCount}</b> ${pinCount === 1 ? 'posición fijada' : 'posiciones fijadas'}; el resto se rellena automáticamente. `
      + `Escribe el <b>nº</b> de posición (p. ej. 45 = página 3), arrastra, o pulsa «Fijar aquí». Luego «Guardar orden».`;
    $('#ord-pager').innerHTML = slotPagerHtml(pages);
    if (!total) { $('#ord-board').innerHTML = '<div class="ord-empty">No hay empresas en este contexto todavía.</div>'; return; }
    const from = (slotPage - 1) * ORD_PAGE, slice = order.slice(from, from + ORD_PAGE);
    const nPin = slice.filter(id => slotPins.has(id)).length;
    $('#ord-board').innerHTML = `<div class="ord-page"><div class="ord-page-head"><b>Página ${slotPage}</b><span class="ord-page-count">posiciones ${from + 1}–${from + slice.length} · ${nPin} ${nPin === 1 ? 'fijada' : 'fijadas'}, ${slice.length - nPin} automáticas</span></div>
      <ul class="ord-slots">${slice.map((id, i) => slotRow(id, from + i + 1)).join('')}</ul></div>`;
    const posIn = $('#ord-add-pos'); if (posIn && !posIn.dataset.touched) posIn.value = slotFirstFree(slotPage);
    ordRenderAdd();
  }

  /* ------------------------------ Modo home ------------------------------- */
  function homeRow(b, pos) {
    return `<li class="ord-slot is-pinned" draggable="true" data-id="${attr(b.id)}" data-pos="${pos}">
      <span class="ord-grip" aria-hidden="true" title="Arrastra para reordenar">⠿</span>
      <input class="ord-pos-input" type="number" min="1" value="${pos}" data-ordpos title="Escribe la posición (nº) y pulsa Enter" aria-label="Posición" />
      <span class="ord-thumb"><img src="${ordThumb(b.cover, b.name)}" alt="" /></span>
      <span class="ord-info"><span class="ord-name">${esc(b.name)}${b.featured ? ' ★' : ''}</span><span class="ord-zone">${esc(b.zone || '')}${b.reviews ? ` · ${fmt(b.reviews)} reseñas` : ''}</span></span>
      <span class="ord-slot-actions">
        <button class="icon-btn" data-ord="up" title="Subir">▲</button>
        <button class="icon-btn" data-ord="down" title="Bajar">▼</button>
        <button class="icon-btn danger" data-ord="remove" title="Quitar de destacadas">${IC.trash}</button>
      </span>
    </li>`;
  }
  function homeRender() {
    const n = ordItems.length, pages = Math.max(1, Math.ceil(n / ORD_PAGE));
    $('#ord-status').innerHTML = `<b>Empresas destacadas</b>: ${n} en la lista · ${pages} ${pages === 1 ? 'página' : 'páginas'} de 20. `
      + `La página 1 sale en la portada; las siguientes en <a href="/destacadas" target="_blank" rel="noopener">/destacadas</a>. Escribe el <b>nº</b> de posición, arrastra o usa ▲▼, y «Guardar orden».`;
    $('#ord-pager').innerHTML = '';
    if (!n) { $('#ord-board').innerHTML = '<div class="ord-empty">Aún no has elegido empresas destacadas (la portada muestra 20 al azar). Añádelas abajo.</div>'; }
    else {
      let html = '';
      for (let pg = 0; pg < pages; pg++) {
        const slice = ordItems.slice(pg * ORD_PAGE, (pg + 1) * ORD_PAGE);
        html += `<div class="ord-page"><div class="ord-page-head"><b>Página ${pg + 1}</b><span class="ord-page-count">${pg === 0 ? 'portada · ' : ''}posiciones ${pg * ORD_PAGE + 1}–${pg * ORD_PAGE + slice.length}</span></div>`;
        html += `<ul class="ord-slots">${slice.map((b, i) => homeRow(b, pg * ORD_PAGE + i + 1)).join('')}</ul></div>`;
      }
      $('#ord-board').innerHTML = html;
    }
    const posIn = $('#ord-add-pos'); if (posIn && !posIn.dataset.touched) posIn.value = n + 1;
    ordRenderAdd();
  }
  function homeMoveTo(id, pos) {
    const i = ordItems.findIndex(b => b.id === id); if (i < 0) return false;
    pos = clampInt(pos, 1, ordItems.length);
    if (pos === i + 1) return false;
    const [b] = ordItems.splice(i, 1);
    ordItems.splice(pos - 1, 0, b);
    ordSetDirty(true);
    return true;
  }

  /* --------------------------- Añadir / buscar ---------------------------- */
  function ordRenderAdd() {
    const q = norm($('#ord-add-search').value || '');
    let rows;
    if (ordKind === 'slots') {
      const order = slotOrder(), posOf = new Map(order.map((id, i) => [id, i + 1]));
      const list = q ? slotAll.filter(b => norm(b.n + ' ' + (b.z || '')).includes(q)) : [];
      rows = list.slice(0, 40).map(b => {
        const pos = posOf.get(b.id), pg = Math.ceil(pos / ORD_PAGE);
        return `<div class="ord-add-row"><span class="ord-thumb"><img src="${ordThumb(b.c, b.n)}" alt=""></span><span class="ord-name">${esc(b.n)}<small class="muted" style="display:block;font-weight:500">${esc(b.z || '')}${b.r ? ` · ${fmt(b.r)} reseñas` : ''} · ahora nº ${pos} (pág. ${pg})${slotPins.has(b.id) ? ' · fijada' : ''}</small></span><button class="btn btn-soft btn-sm" data-add="${attr(b.id)}">Poner aquí</button></div>`;
      });
      $('#ord-add-list').innerHTML = rows.length ? rows.join('')
        : `<p class="muted" style="padding:8px 4px">${q ? 'Sin resultados en este servicio.' : 'Escribe para buscar una empresa de este servicio y ponerla en la posición que quieras.'}</p>`;
      return;
    }
    const inList = new Set(ordItems.map(b => b.id));
    const list = ordAvailable.filter(b => !inList.has(b.id));
    $('#ord-add-list').innerHTML = list.length
      ? list.map(b => `<div class="ord-add-row"><span class="ord-thumb"><img src="${ordThumb(b.cover, b.name)}" alt=""></span><span class="ord-name">${esc(b.name)}<small class="muted" style="display:block;font-weight:500">${esc(b.zone || '')}${b.reviews ? ` · ${fmt(b.reviews)} reseñas` : ''}</small></span><button class="btn btn-soft btn-sm" data-add="${attr(b.id)}">Añadir</button></div>`).join('')
      : `<p class="muted" style="padding:8px 4px">${$('#ord-add-search').value.trim() ? 'Sin resultados para esa búsqueda.' : 'No hay más empresas para añadir.'}</p>`;
  }
  let ordSearchT = null, ordSearchSeq = 0;
  async function ordSearch() {
    if (ordKind === 'slots') { ordRenderAdd(); return; }   // căutare locală în nișă
    const seq = ++ordSearchSeq;
    try {
      const d = await api.getPlacements('home', $('#ord-add-search').value.trim());
      if (seq !== ordSearchSeq) return;   // a sosit un răspuns mai nou
      ordAvailable = d.available || [];
      ordRenderAdd();
    } catch { /* ignoră */ }
  }
  function ordAdd(id) {
    const pos = parseInt($('#ord-add-pos').value, 10);
    if (ordKind === 'slots') {
      const b = slotInfo.get(id); if (!b) return;
      slotMoveTo(id, pos || slotFirstFree(slotPage));
      const where = slotOrder().indexOf(id) + 1;
      slotPage = Math.ceil(where / ORD_PAGE);
      delete $('#ord-add-pos').dataset.touched;
      slotRender();
      toast(`«${b.n}» fijada en el nº ${where} (página ${slotPage}). Pulsa «Guardar orden».`);
      return;
    }
    const idx = ordAvailable.findIndex(b => b.id === id); if (idx < 0) return;
    const [b] = ordAvailable.splice(idx, 1);
    const at = clampInt(pos || ordItems.length + 1, 1, ordItems.length + 1);
    ordItems.splice(at - 1, 0, b);
    ordSetDirty(true);
    delete $('#ord-add-pos').dataset.touched;
    homeRender();
    toast(`«${b.name}» añadida en el nº ${at} (página ${Math.ceil(at / ORD_PAGE)}). Pulsa «Guardar orden».`);
  }

  /* ------------------------------ Carga / guardar ------------------------- */
  function ordRender() { if (ordKind === 'slots') slotRender(); else if (ordKind === 'home') homeRender(); }
  async function ordLoad() {
    ordCtx = ordResolveContext();
    const board = $('#ord-board'), status = $('#ord-status'), add = $('#ord-add');
    ordSetDirty(false);
    $('#ord-pager').innerHTML = '';
    if (!ordCtx) { ordKind = null; board.innerHTML = ''; add.style.display = 'none'; status.textContent = 'Elige servicio, zona o municipio para ver el clasamento.'; return; }
    status.textContent = 'Cargando…'; board.innerHTML = '';
    try {
      const d = await api.getPlacements(ordCtx, ordCtx === 'home' ? ($('#ord-add-search').value.trim() || undefined) : undefined);
      ordKind = d.kind === 'home' ? 'home' : 'slots';
      add.style.display = '';
      $('#ord-add-head').innerHTML = ordKind === 'home'
        ? 'Añadir empresas a «Empresas destacadas» <span class="muted" style="font-weight:500">— busca entre todas las empresas</span>'
        : 'Poner una empresa en una posición concreta <span class="muted" style="font-weight:500">— busca dentro de este servicio</span>';
      delete $('#ord-add-pos').dataset.touched;
      if (ordKind === 'home') { ordItems = d.items || []; ordAvailable = d.available || []; }
      else {
        slotAll = d.all || []; slotInfo = new Map(slotAll.map(b => [b.id, b]));
        slotPins = new Map((d.pins || []).map(p => [p.id, p.pos])); slotPage = 1;
      }
      ordRender();
    } catch (e) {
      status.textContent = 'No se pudo cargar el clasamento.';
      if (e.status === 401) location.replace('login.html');
    }
  }
  async function ordSave() {
    if (!ordCtx) return;
    $('#ord-save').disabled = true;
    try {
      if (ordKind === 'slots') await api.setPlacementSlots(ordCtx, [...slotPins.entries()].filter(([id]) => slotInfo.has(id)).map(([id, pos]) => ({ id, pos })));
      else await api.setPlacements(ordCtx, ordItems.map(b => b.id));
      ordSetDirty(false);
      toast('Orden guardado — ya se ve así en la web');
    } catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo guardar el orden', 'err'); }
    finally { $('#ord-save').disabled = false; }
  }
  async function ordReset() {
    if (!ordCtx) return;
    const msg = ordKind === 'home' ? '¿Vaciar la lista de Empresas destacadas? (la portada mostrará empresas al azar)' : '¿Quitar todas las posiciones fijadas de este servicio/zona? Volverá al orden automático.';
    if (!confirm(msg)) return;
    try { await api.clearPlacements(ordCtx); toast('Restablecido'); await ordLoad(); }
    catch (e) { toast(e.status === 401 ? 'Sesión expirada' : 'No se pudo restablecer', 'err'); }
  }
  function ordMove(id, pos) {
    const changed = ordKind === 'slots' ? slotMoveTo(id, pos) : homeMoveTo(id, pos);
    if (changed && ordKind === 'slots') { const where = slotOrder().indexOf(id) + 1; slotPage = Math.ceil(where / ORD_PAGE); }
    ordRender();
  }
  function bindOrden() {
    let lastCtxValues = null;
    const ctxSelects = ['ord-type', 'ord-cat', 'ord-scope', 'ord-zona', 'ord-mun'];
    const snapshot = () => ctxSelects.map(id => $('#' + id).value);
    ctxSelects.forEach(id => {
      $('#' + id).addEventListener('focus', () => { lastCtxValues = snapshot(); });
      $('#' + id).addEventListener('change', () => {
        if (ordDirty && !confirm('Hay cambios sin guardar en este clasamento. ¿Descartarlos?')) {
          if (lastCtxValues) ctxSelects.forEach((sid, i) => { $('#' + sid).value = lastCtxValues[i]; });
          ordSyncFields(); return;
        }
        ordSyncFields(); ordLoad();
      });
    });
    $('#ord-save').addEventListener('click', ordSave);
    $('#ord-reset').addEventListener('click', ordReset);
    $('#ord-add-search').addEventListener('input', () => { clearTimeout(ordSearchT); ordSearchT = setTimeout(ordSearch, ordKind === 'slots' ? 120 : 250); });
    $('#ord-add-pos').addEventListener('input', e => { e.target.dataset.touched = '1'; });
    $('#ord-add-list').addEventListener('click', e => { const btn = e.target.closest('button[data-add]'); if (btn) ordAdd(btn.dataset.add); });
    $('#ord-pager').addEventListener('click', e => {
      const b = e.target.closest('[data-goto]'); if (!b || b.disabled) return;
      slotPage = parseInt(b.dataset.goto, 10) || 1; delete $('#ord-add-pos').dataset.touched; slotRender();
    });
    $('#ord-pager').addEventListener('change', e => {
      if (!e.target.matches('[data-pagesel]')) return;
      slotPage = parseInt(e.target.value, 10) || 1; delete $('#ord-add-pos').dataset.touched; slotRender();
    });
    const board = $('#ord-board');
    board.addEventListener('click', e => {
      const btn = e.target.closest('button[data-ord]'); if (!btn) return;
      const slot = btn.closest('.ord-slot'); const id = slot.dataset.id, pos = parseInt(slot.dataset.pos, 10);
      const act = btn.dataset.ord;
      if (act === 'up') ordMove(id, pos - 1);
      else if (act === 'down') ordMove(id, pos + 1);
      else if (act === 'pin') { slotPins.set(id, pos); ordSetDirty(true); slotRender(); }
      else if (act === 'unpin') { slotPins.delete(id); ordSetDirty(true); slotRender(); }
      else if (act === 'remove') { const i = ordItems.findIndex(x => x.id === id); if (i >= 0) { const [b] = ordItems.splice(i, 1); ordAvailable.unshift(b); ordSetDirty(true); homeRender(); } }
    });
    // Poziție scrisă de mână: Enter (sau ieșirea din câmp) mută firma acolo.
    board.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-ordpos]')) { e.preventDefault(); e.target.blur(); } });
    board.addEventListener('change', e => {
      if (!e.target.matches('[data-ordpos]')) return;
      const slot = e.target.closest('.ord-slot');
      ordMove(slot.dataset.id, e.target.value);
    });
    board.addEventListener('dragstart', e => {
      if (e.target.matches && e.target.matches('input')) return;
      const s = e.target.closest('.ord-slot'); if (!s) return;
      ordDragId = s.dataset.id; s.classList.add('dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
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
      if (s.dataset.id !== ordDragId) ordMove(ordDragId, parseInt(s.dataset.pos, 10));
    });
    window.addEventListener('beforeunload', e => { if (ordDirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  async function ordEnter() {
    if (!ordInited) {
      try { ordZones = await api.zones(); } catch { ordZones = []; }
      ordFillSelectors();
      // Arranca en «Por servicio» con el primer nicho, para que el drag & drop
      // se vea de inmediato (el contexto «Home» empieza vacío y confunde).
      if (categoriesTree.length) { $('#ord-type').value = 'cat'; $('#ord-cat').value = categoriesTree[0].slug; }
      ordSyncFields(); ordInited = true;
    }
    if (!ordDirty) ordLoad();   // cu modificări nesalvate păstrăm panoul cum e
  }

  /* --------------------------- View switching --------------------------- */
  function switchView(v) {
    $$('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $('#view-negocios').classList.toggle('hidden', v !== 'negocios');
    $('#view-leads').classList.toggle('hidden', v !== 'leads');
    $('#view-taxonomia').classList.toggle('hidden', v !== 'taxonomia');
    $('#view-orden').classList.toggle('hidden', v !== 'orden');
    $('#view-stats').classList.toggle('hidden', v !== 'stats');
    $('#view-historias').classList.toggle('hidden', v !== 'historias');
    if (v === 'leads') renderLeads();
    if (v === 'historias') renderStories();
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
    fillDistrictSelects(); buildCategoryChecklist(); buildMetroChecklist(); fillBizCatFilter();

    bindBusinesses(); bindDrawer(); bindStats(); bindImport(); bindTaxonomy(); bindOrden(); bindLeads(); bindStories();
    $$('.admin-nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('[data-goview]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); switchView(el.dataset.goview); }));
    // Local, fără login (me.noLogin) → ascundem „salir": nu are unde să te ducă.
    if (me.noLogin) $('#logoutBtn').classList.add('hidden');
    else $('#logoutBtn').addEventListener('click', async e => { e.preventDefault(); try { await api.logout(); } catch {} location.replace('login.html'); });
    $('#adminApp').classList.remove('hidden');
    renderBusinesses();
    refreshLeadBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
