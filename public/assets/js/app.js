/* =========================================================================
   app.js — Home: încarcă clinicile din API, search live, filtre, sortare,
   modal detalii, deep-link (#clinica=slug), tracking real (vizite/view/contact).
   ========================================================================= */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const D = window.DDM, I = D.icons;
  const esc = D.esc, attr = D.attr, norm = D.norm;

  const state = { query: '', zone: '', service: '', sort: 'destacadas' };
  let clinics = [];
  let currentModalId = null;

  /* ---------------------------- Rendering ------------------------------- */
  function ratingBadge(c, cls) {
    if (c.rating == null) return '';
    return `<span class="${cls}">${I.star}${D.rating1(c.rating)}</span>`;
  }
  function cardHTML(c) {
    const tags = c.services.slice(0, 3).map(s => `<span class="tag">${esc(s)}</span>`).join('');
    const extra = c.services.length > 3 ? `<span class="tag tag-more">+${c.services.length - 3}</span>` : '';
    return `
      <article class="card" tabindex="0" role="button" data-id="${attr(c.id)}" aria-label="Ver ${attr(c.name)}">
        <div class="card-media">
          ${c.featured ? `<span class="badge-featured">${I.star}Destacada</span>` : ''}
          ${ratingBadge(c, 'card-rating')}
          <img src="${attr(D.clinicPhoto(c))}" alt="${attr(c.name)}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(c.name)}</h3>
          <span class="card-zone">${I.pin}${esc(c.zone)}</span>
          <div class="card-tags">${tags}${extra}</div>
          <div class="card-foot"><span class="card-cta">Ver detalles ${I.arrow}</span></div>
        </div>
      </article>`;
  }

  function getFiltered() {
    const tokens = norm(state.query).split(/\s+/).filter(Boolean);
    let list = clinics.filter(c => {
      if (state.zone && c.zone !== state.zone) return false;
      if (state.service && !c.services.includes(state.service)) return false;
      if (tokens.length) {
        const hay = norm([c.name, c.zone, c.address, c.services.join(' ')].join(' '));
        if (!tokens.every(t => hay.includes(t))) return false;
      }
      return true;
    });
    if (state.sort === 'nombre') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (state.sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else list.sort((a, b) => (b.featured - a.featured) || ((b.rating || 0) - (a.rating || 0)));
    return list;
  }

  function renderGrid() {
    const grid = $('#grid');
    const list = getFiltered();
    $('#resultsCount').innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'clínica' : 'clínicas'}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty"><div class="empty-icn">${I.searchBig}</div><h3>Sin resultados</h3><p>Prueba con otra búsqueda, zona o servicio.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(cardHTML).join('');
  }

  /* ------------------------------ Modal --------------------------------- */
  function hoursHTML(c) {
    const today = D.todayKey();
    return D.DAYS.map(d => {
      const v = (c.hours && c.hours[d.key]) || 'Cerrado';
      const closed = /cerrado/i.test(v);
      return `<div class="hours-row${d.key === today ? ' today' : ''}"><span class="d">${d.label}${d.key === today ? ' · Hoy' : ''}</span><span class="h ${closed ? 'closed' : ''}">${esc(v)}</span></div>`;
    }).join('');
  }
  function contactHTML(c) {
    const items = [];
    if (c.phone) items.push(`<div class="contact-item"><span class="ci-icn">${I.phone}</span><div class="ci-txt"><small>Teléfono</small><a href="tel:${attr(c.phone.replace(/\s+/g, ''))}" data-track="phone">${esc(c.phone)}</a></div></div>`);
    if (c.email) items.push(`<div class="contact-item"><span class="ci-icn">${I.mail}</span><div class="ci-txt"><small>Email</small><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></div></div>`);
    if (c.website) items.push(`<div class="contact-item"><span class="ci-icn">${I.globe}</span><div class="ci-txt"><small>Sitio web</small><a href="${attr(c.website)}" target="_blank" rel="noopener" data-track="web">${esc(c.website.replace(/^https?:\/\//, ''))}</a></div></div>`);
    if (c.address) items.push(`<div class="contact-item"><span class="ci-icn">${I.map}</span><div class="ci-txt"><small>Dirección</small><span>${esc(c.address)}</span></div></div>`);
    return items.join('');
  }
  function socialsHTML(c) {
    const s = c.social || {};
    const btns = D.SOCIAL_ORDER.filter(k => s[k]).map(k =>
      `<a class="social-btn" href="${attr(s[k])}" target="_blank" rel="noopener" title="${D.SOCIAL_LABEL[k]}" aria-label="${D.SOCIAL_LABEL[k]}">${I[k]}</a>`).join('');
    return btns ? `<div class="modal-section"><h4>Redes sociales</h4><div class="socials">${btns}</div></div>` : '';
  }
  function modalHTML(c) {
    return `
      <button class="modal-close" id="modalClose" aria-label="Cerrar">${I.close}</button>
      <div class="modal-hero">
        ${ratingBadge(c, 'modal-rating')}
        <img src="${attr(D.clinicPhoto(c))}" alt="${attr(c.name)}" />
        <div class="modal-hero-caption"><h2 id="modalTitle">${esc(c.name)}</h2><span class="card-zone">${I.pin}${esc(c.zone)}</span></div>
      </div>
      <div class="modal-body">
        <div class="modal-actions">
          ${c.phone ? `<a class="btn btn-primary" href="tel:${attr(c.phone.replace(/\s+/g, ''))}" data-track="phone">${I.phone} Llamar</a>` : ''}
          ${c.website ? `<a class="btn btn-ghost" href="${attr(c.website)}" target="_blank" rel="noopener" data-track="web">${I.globe} Visitar web</a>` : ''}
          ${c.email ? `<a class="btn btn-ghost" href="mailto:${attr(c.email)}">${I.mail} Email</a>` : ''}
        </div>
        ${c.about ? `<div class="modal-section"><h4>Sobre nosotros</h4><p class="modal-about">${esc(c.about)}</p></div>` : ''}
        ${c.services.length ? `<div class="modal-section"><h4>Servicios</h4><div class="chips">${c.services.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>` : ''}
        <div class="modal-section"><h4>Horario</h4><div class="hours-table">${hoursHTML(c)}</div></div>
        <div class="modal-section"><h4>Contacto</h4><div class="contact-grid">${contactHTML(c)}</div></div>
        ${socialsHTML(c)}
      </div>`;
  }

  function openModal(id) {
    const c = clinics.find(x => x.id === id);
    if (!c) return;
    currentModalId = id;
    $('#modalContent').innerHTML = modalHTML(c);
    const bd = $('#modalBackdrop');
    bd.classList.add('open'); bd.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#modalContent').scrollTop = 0;
    $('#modalClose').addEventListener('click', closeModal);
    D.api.trackView(id);
    if (('#clinica=' + id) !== location.hash) history.replaceState(null, '', '#clinica=' + id);
  }
  function closeModal() {
    const bd = $('#modalBackdrop');
    bd.classList.remove('open'); bd.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentModalId = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---------------------------- Filters UI ------------------------------ */
  function populateFilters() {
    const zones = Array.from(new Set(clinics.map(c => c.zone).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const services = Array.from(new Set(clinics.flatMap(c => c.services))).sort((a, b) => a.localeCompare(b, 'es'));
    $('#filterZone').insertAdjacentHTML('beforeend', zones.map(z => `<option value="${attr(z)}">${esc(z)}</option>`).join(''));
    $('#filterService').insertAdjacentHTML('beforeend', services.map(s => `<option value="${attr(s)}">${esc(s)}</option>`).join(''));
  }
  function renderHeroStats() {
    const zones = new Set(clinics.map(c => c.zone).filter(Boolean));
    const rated = clinics.filter(c => c.rating != null);
    const avg = rated.length ? rated.reduce((a, c) => a + c.rating, 0) / rated.length : 0;
    $('#statClinics').textContent = clinics.length;
    $('#statZones').textContent = zones.size;
    $('#statRating').textContent = avg ? D.rating1(avg) : '—';
  }

  /* ------------------------------ Events -------------------------------- */
  function bind() {
    let t;
    $('#searchInput').addEventListener('input', e => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => { state.query = v; renderGrid(); }, 120); });
    $('#searchBtn').addEventListener('click', () => { state.query = $('#searchInput').value; renderGrid(); });
    $('#filterZone').addEventListener('change', e => { state.zone = e.target.value; renderGrid(); });
    $('#filterService').addEventListener('change', e => { state.service = e.target.value; renderGrid(); });
    $('#sortBy').addEventListener('change', e => { state.sort = e.target.value; renderGrid(); });

    $('#grid').addEventListener('click', e => { const card = e.target.closest('.card'); if (card) openModal(card.dataset.id); });
    $('#grid').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.card')) { e.preventDefault(); openModal(e.target.closest('.card').dataset.id); }
    });

    $('#modalContent').addEventListener('click', e => { const tr = e.target.closest('[data-track]'); if (tr) D.api.trackContact(tr.getAttribute('data-track')); });
    $('#modalBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && currentModalId) closeModal(); });
    window.addEventListener('hashchange', () => {
      const id = parseHash();
      if (id && id !== currentModalId) openModal(id);
      else if (!id && currentModalId) closeModal();
    });
  }
  function parseHash() { const m = location.hash.match(/clinica=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; }

  /* ------------------------------- Init --------------------------------- */
  async function init() {
    bind();
    D.api.trackVisit();
    try {
      clinics = await D.api.listClinics();
    } catch (e) {
      $('#grid').innerHTML = `<div class="empty"><div class="empty-icn">${I.searchBig}</div><h3>No se pudo cargar</h3><p>¿Está el servidor en marcha? (npm start)</p></div>`;
      return;
    }
    populateFilters();
    renderHeroStats();
    renderGrid();
    const id = parseHash();
    if (id) openModal(id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
