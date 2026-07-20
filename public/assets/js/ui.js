/* =========================================================================
   ui.js — Modul comun pe client (namespace DDM): helpers, icons,
   placeholder de imagine, catalog servicii, zile, toast.
   Folosit de app.js (home) și admin.js.
   ========================================================================= */
window.DDM = window.DDM || {};

/* ------------------------------ Zile ---------------------------------- */
DDM.DAYS = [
  { key: 'lunes', label: 'Lunes' }, { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' }, { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' }, { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];
DDM.todayKey = () => ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];

DDM.SERVICE_CATALOG = [
  'Odontología general', 'Implantología', 'Ortodoncia invisible', 'Ortodoncia',
  'Estética dental', 'Blanqueamiento', 'Carillas', 'Diseño de sonrisa',
  'Periodoncia', 'Endodoncia', 'Odontopediatría', 'Prótesis dental',
  'Cirugía oral', 'Higiene dental', 'Prevención', 'Odontología familiar',
  'Urgencias dentales',
];

/* ------------------------------ Helpers ------------------------------- */
DDM.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
DDM.attr = s => DDM.esc(s).replace(/"/g, '&quot;');
DDM.norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
DDM.fmt = n => Number(n || 0).toLocaleString('es-ES');
DDM.rating1 = n => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* --------------------------- Placeholder ------------------------------ */
DDM._GRADIENTS = [
  ['#0ea5a9', '#22c3a6'], ['#2563eb', '#38bdf8'], ['#7c3aed', '#a78bfa'],
  ['#db2777', '#fb7185'], ['#0891b2', '#5eead4'], ['#ea580c', '#fbbf24'],
  ['#0f766e', '#2dd4bf'], ['#4f46e5', '#818cf8'],
];
DDM._hash = str => { let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; } return Math.abs(h); };
DDM.initials = name => {
  const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const a = w[0] ? w[0][0] : '?';
  const b = w[1] ? w[1][0] : (w[0] && w[0][1] ? w[0][1] : '');
  return (a + b).toUpperCase();
};
DDM.placeholderImage = name => {
  const h = DDM._hash(name || 'clinic');
  const [c1, c2] = DDM._GRADIENTS[h % DDM._GRADIENTS.length];
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="640" cy="120" r="230" fill="#ffffff" opacity="0.10"/>
  <circle cx="150" cy="520" r="180" fill="#ffffff" opacity="0.08"/>
  <text x="400" y="330" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="180" font-weight="800" fill="#ffffff" text-anchor="middle" opacity="0.95">${DDM.initials(name)}</text>
  <text x="400" y="410" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="30" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.85" letter-spacing="4">CLÍNICA DENTAL</text>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
};
DDM.clinicPhoto = c => (c && c.photo) ? c.photo : DDM.placeholderImage(c ? c.name : '');

/* ------------------------------- Social ------------------------------- */
DDM.SOCIAL_ORDER = ['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin', 'youtube'];
DDM.SOCIAL_LABEL = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'X (Twitter)', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube' };

/* ------------------------------- Icons -------------------------------- */
DDM.icons = {
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  star: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8L12 2z"/></svg>',
  arrow: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.4-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/></svg>',
  map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z"/></svg>',
  twitter: '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.5 7.4L22 22h-6.2l-4.8-6.3L5.5 22H2.7l6.9-7.9L2 2h6.3l4.4 5.8L18.2 2zm-1 18h1.6L7.1 3.7H5.4L17.2 20z"/></svg>',
  linkedin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9 5.3a1.9 1.9 0 11-3.8 0 1.9 1.9 0 013.8 0zM3.4 8.5h3.1V21H3.4V8.5zM9.3 8.5h3v1.7h.05c.42-.8 1.44-1.7 3-1.7 3.2 0 3.8 2.1 3.8 4.9V21h-3.1v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9.3V8.5z"/></svg>',
  tiktok: '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.8v2.4c-1.2.1-2.3-.2-3.5-.9v6.1c0 3.5-2.5 5.6-5.4 5.6-2.7 0-5.1-1.9-5.1-5 0-3 2.3-5 5.4-4.8v2.5c-.5-.1-1-.2-1.5-.1-1.1.2-1.9 1-1.8 2.3.1 1.2 1 2 2.1 2 1.3 0 2.2-1 2.2-2.6V3h2.6z"/></svg>',
  youtube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 00-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 001.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 001.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 001.8-1.8C23 15.2 23 12 23 12zm-13 3V9l5.2 3-5.2 3z"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  searchBig: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>',
  eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  card: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 14h4"/></svg>',
};

/* ------------------------------- Toast -------------------------------- */
DDM.toast = function (msg, type) {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toastWrap'; wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : '');
  el.innerHTML = (type === 'err' ? DDM.icons.x : DDM.icons.check) + '<span>' + DDM.esc(msg) + '</span>';
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; el.style.transition = 'all .3s'; }, 2200);
  setTimeout(() => el.remove(), 2600);
};
