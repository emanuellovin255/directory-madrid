/* =========================================================================
   seed.js — Populează DB la prima pornire (dacă e gol):
   - Geografie Madrid (21 distritos + barrios) din data/madrid-geo.json
   - Categorii de servicii + subcategorii (contractori/reformas)
   - Stații de metrou cheie
   - Negocii demo (contractori fictivi, zone reale Madrid) + istoric analytics
   ========================================================================= */
'use strict';
const DB = require('./db');
const GEO = require('./data/madrid-geo.json');
const MUNIS = require('./data/madrid-municipios.json');
const BARRIOS = require('./data/madrid-barrios.json').barrios;   // { municipioSlug: [{slug,name}] }

/* --------------------------- Categorii ------------------------------- */
const CATEGORIES = [
  {
    slug: 'reformas', name: 'Reformas', icon: 'reformas',
    intro: 'Empresas de reformas integrales y por gremios en Madrid: baños, cocinas, locales y viviendas. Compara profesionales por distrito, barrio y estación de metro.',
    children: [
      { slug: 'reformas-integrales', name: 'Reformas integrales' },
      { slug: 'reformas-banos', name: 'Reformas de baños' },
      { slug: 'reformas-cocinas', name: 'Reformas de cocinas' },
      { slug: 'reformas-locales', name: 'Reformas de locales' },
    ],
  },
  {
    slug: 'fontaneros', name: 'Fontaneros', icon: 'fontaneros',
    intro: 'Fontaneros en Madrid para averías, desatascos, fugas de agua y calderas. Encuentra un fontanero cerca de tu barrio o estación de metro.',
    children: [
      { slug: 'desatascos', name: 'Desatascos' },
      { slug: 'fugas-de-agua', name: 'Reparación de fugas' },
      { slug: 'calderas', name: 'Calderas y calentadores' },
      { slug: 'instalacion-fontaneria', name: 'Instalación de fontanería' },
    ],
  },
  {
    slug: 'electricistas', name: 'Electricistas', icon: 'electricistas',
    intro: 'Electricistas autorizados en Madrid: instalaciones, boletín eléctrico, averías urgentes e iluminación. Localiza un electricista por zona.',
    children: [
      { slug: 'instalaciones-electricas', name: 'Instalaciones eléctricas' },
      { slug: 'boletin-electrico', name: 'Boletín eléctrico (CIE)' },
      { slug: 'averias-electricas', name: 'Averías y urgencias' },
      { slug: 'iluminacion', name: 'Iluminación' },
    ],
  },
  {
    slug: 'climatizacion', name: 'Climatización', icon: 'climatizacion',
    intro: 'Instaladores de climatización en Madrid: aire acondicionado, calefacción, bombas de calor y mantenimiento. Compara presupuestos por barrio.',
    children: [
      { slug: 'aire-acondicionado', name: 'Aire acondicionado' },
      { slug: 'calefaccion', name: 'Calefacción' },
      { slug: 'bombas-de-calor', name: 'Bombas de calor' },
      { slug: 'mantenimiento-clima', name: 'Mantenimiento' },
    ],
  },
  {
    slug: 'cerrajeros', name: 'Cerrajeros', icon: 'cerrajeros',
    intro: 'Cerrajeros en Madrid disponibles para aperturas de puertas, cambio de cerraduras y urgencias 24h. Encuentra un cerrajero cerca de ti.',
    children: [
      { slug: 'apertura-puertas', name: 'Apertura de puertas' },
      { slug: 'cambio-cerraduras', name: 'Cambio de cerraduras' },
      { slug: 'cerrajeria-urgente', name: 'Cerrajería urgente 24h' },
      { slug: 'puertas-acorazadas', name: 'Puertas acorazadas' },
    ],
  },
  {
    slug: 'control-de-plagas', name: 'Control de plagas', icon: 'control-de-plagas',
    intro: 'Empresas de control de plagas en Madrid: desinsectación, desratización y desinfección para hogares, comunidades y locales. Compara profesionales por distrito, barrio y estación de metro.',
    children: [
      { slug: 'desinsectacion', name: 'Desinsectación' },
      { slug: 'desratizacion', name: 'Desratización' },
      { slug: 'control-termitas', name: 'Control de termitas' },
      { slug: 'desinfeccion', name: 'Desinfección' },
    ],
  },
  {
    slug: 'mudanzas', name: 'Mudanzas', icon: 'mudanzas',
    intro: 'Empresas de mudanzas en Madrid: mudanzas locales y nacionales, guardamuebles y montaje de muebles. Encuentra una empresa de mudanzas cerca de tu barrio o estación de metro.',
    children: [
      { slug: 'mudanzas-locales', name: 'Mudanzas locales' },
      { slug: 'mudanzas-nacionales', name: 'Mudanzas nacionales' },
      { slug: 'guardamuebles', name: 'Guardamuebles' },
      { slug: 'montaje-muebles', name: 'Montaje de muebles' },
    ],
  },
  {
    slug: 'talleres', name: 'Talleres', icon: 'talleres',
    intro: 'Talleres en Madrid: mecánica, chapa y pintura, neumáticos y electricidad del automóvil. Localiza un taller de confianza por zona o estación de metro.',
    children: [
      { slug: 'talleres-mecanicos', name: 'Talleres mecánicos' },
      { slug: 'chapa-y-pintura', name: 'Chapa y pintura' },
      { slug: 'neumaticos', name: 'Neumáticos' },
      { slug: 'electricidad-automovil', name: 'Electricidad del automóvil' },
    ],
  },
];

/* ----------------------- Metrou (set cheie) -------------------------- */
const METROS = [
  { name: 'Sol', lines: ['1', '2', '3'] },
  { name: 'Gran Vía', lines: ['1', '5'] },
  { name: 'Callao', lines: ['3', '5'] },
  { name: 'Cuatro Caminos', lines: ['1', '2', '6'] },
  { name: 'Nuevos Ministerios', lines: ['6', '8', '10'] },
  { name: 'Avenida de América', lines: ['4', '6', '7', '9'] },
  { name: 'Moncloa', lines: ['3', '6'] },
  { name: 'Príncipe Pío', lines: ['6', '10', 'R'] },
  { name: 'Plaza de España', lines: ['3', '10'] },
  { name: 'Bilbao', lines: ['1', '4'] },
  { name: 'Alonso Martínez', lines: ['4', '5', '10'] },
  { name: 'Chueca', lines: ['5'] },
  { name: 'Tribunal', lines: ['1', '10'] },
  { name: 'Goya', lines: ['2', '4'] },
  { name: 'Serrano', lines: ['4'] },
  { name: 'Velázquez', lines: ['4'] },
  { name: 'Diego de León', lines: ['4', '5', '6'] },
  { name: 'Chamartín', lines: ['1', '10'] },
  { name: 'Atocha', lines: ['1'] },
  { name: 'Legazpi', lines: ['3', '6'] },
  { name: 'Príncipe de Vergara', lines: ['2', '9'] },
  { name: 'Argüelles', lines: ['3', '4', '6'] },
  { name: 'San Bernardo', lines: ['2', '4'] },
  { name: 'Quevedo', lines: ['2'] },
  { name: 'Ríos Rosas', lines: ['1'] },
  { name: 'Cuzco', lines: ['10'] },
  { name: 'Santiago Bernabéu', lines: ['10'] },
  { name: 'Ventas', lines: ['2', '5'] },
  { name: 'Manuel Becerra', lines: ['2', '6'] },
  { name: 'Pacífico', lines: ['1', '6'] },
  { name: 'Retiro', lines: ['2'] },
  { name: 'Sainz de Baranda', lines: ['6', '9'] },
  { name: 'Estrecho', lines: ['1'] },
  { name: 'Aluche', lines: ['5'] },
];

/* --------------------------- Negocii demo ---------------------------- */
const H_24 = { lunes: '24 horas', martes: '24 horas', miercoles: '24 horas', jueves: '24 horas', viernes: '24 horas', sabado: '24 horas', domingo: '24 horas' };
const H_STD = { lunes: '09:00 – 19:00', martes: '09:00 – 19:00', miercoles: '09:00 – 19:00', jueves: '09:00 – 19:00', viernes: '09:00 – 19:00', sabado: '10:00 – 14:00', domingo: 'Cerrado' };

const DEMO_BUSINESSES = [
  {
    id: 'aquafix-fontaneros-madrid', name: 'AquaFix Fontaneros Madrid',
    districtSlug: 'salamanca', neighborhoodSlug: 'goya',
    categorySlugs: ['fontaneros', 'desatascos', 'fugas-de-agua'], metroSlugs: ['goya', 'velazquez'],
    address: 'Calle de Alcalá 120, 28009 Madrid',
    about: 'Equipo de fontaneros con más de 15 años de experiencia en el Barrio de Salamanca. Reparamos fugas, atascos y averías con presupuesto cerrado y sin sorpresas. Servicio de urgencias todos los días.',
    phone: '+34 910 111 001', email: 'info@aquafixmadrid.example.com', website: 'https://aquafixmadrid.example.com',
    social: { instagram: 'https://instagram.com/aquafixmadrid' }, hours: H_24,
    rating: 4.8, reviews: 187, featured: true, photo: null,
  },
  {
    id: 'cerrajeros-centro-24h', name: 'Cerrajeros Centro 24h',
    districtSlug: 'centro', neighborhoodSlug: 'sol',
    categorySlugs: ['cerrajeros', 'apertura-puertas', 'cerrajeria-urgente'], metroSlugs: ['sol', 'gran-via'],
    address: 'Calle Mayor 15, 28013 Madrid',
    about: 'Cerrajeros en el centro de Madrid disponibles 24 horas. Aperturas de puertas sin dañar la cerradura, cambios de bombín y refuerzos de seguridad. Llegamos en menos de 30 minutos.',
    phone: '+34 910 111 002', email: 'aviso@cerrajeroscentro.example.com', website: 'https://cerrajeroscentro.example.com',
    social: { facebook: 'https://facebook.com/cerrajeroscentro' }, hours: H_24,
    rating: 4.9, reviews: 231, featured: true, photo: null,
  },
  {
    id: 'reformas-integrales-retiro', name: 'Reformas Integrales del Retiro',
    districtSlug: 'retiro', neighborhoodSlug: 'ibiza',
    categorySlugs: ['reformas', 'reformas-integrales', 'reformas-banos'], metroSlugs: ['ibiza', 'sainz-de-baranda'],
    address: 'Calle de Ibiza 40, 28009 Madrid',
    about: 'Especialistas en reformas integrales de viviendas en el distrito de Retiro. Gestionamos el proyecto completo: fontanería, electricidad, albañilería y acabados, con dirección de obra y garantía.',
    phone: '+34 910 111 003', email: 'proyectos@reformasretiro.example.com', website: 'https://reformasretiro.example.com',
    social: { instagram: 'https://instagram.com/reformasretiro', facebook: 'https://facebook.com/reformasretiro' }, hours: H_STD,
    rating: 4.8, reviews: 118, featured: true, photo: null,
  },
  {
    id: 'electrochamberi-24h', name: 'ElectroChamberí 24h',
    districtSlug: 'chamberi', neighborhoodSlug: 'trafalgar',
    categorySlugs: ['electricistas', 'averias-electricas', 'boletin-electrico'], metroSlugs: ['bilbao', 'quevedo'],
    address: 'Calle de Trafalgar 30, 28010 Madrid',
    about: 'Electricistas autorizados en Chamberí. Solucionamos averías, tramitamos el boletín eléctrico (CIE) y realizamos instalaciones nuevas conforme a normativa. Urgencias 24 horas.',
    phone: '+34 910 111 004', email: 'hola@electrochamberi.example.com', website: 'https://electrochamberi.example.com',
    social: { instagram: 'https://instagram.com/electrochamberi' }, hours: H_24,
    rating: 4.7, reviews: 142, featured: true, photo: null,
  },
  {
    id: 'cocinas-reformas-salamanca', name: 'Cocinas & Reformas Salamanca',
    districtSlug: 'salamanca', neighborhoodSlug: 'recoletos',
    categorySlugs: ['reformas', 'reformas-cocinas'], metroSlugs: ['serrano', 'velazquez'],
    address: 'Calle de Claudio Coello 60, 28001 Madrid',
    about: 'Diseño y reforma de cocinas a medida en el Barrio de Salamanca. Trabajamos con las mejores marcas de mobiliario y electrodomésticos, con proyecto 3D y montaje propio.',
    phone: '+34 910 111 005', email: 'info@cocinassalamanca.example.com', website: 'https://cocinassalamanca.example.com',
    social: { instagram: 'https://instagram.com/cocinassalamanca' }, hours: H_STD,
    rating: 4.7, reviews: 88, featured: true, photo: null,
  },
  {
    id: 'clima-center-madrid', name: 'Clima Center Madrid',
    districtSlug: 'chamartin', neighborhoodSlug: 'prosperidad',
    categorySlugs: ['climatizacion', 'aire-acondicionado', 'calefaccion'], metroSlugs: ['avenida-de-america', 'diego-de-leon'],
    address: 'Calle de López de Hoyos 120, 28002 Madrid',
    about: 'Instalación y mantenimiento de aire acondicionado y calefacción en Madrid. Trabajamos con equipos de bajo consumo y ofrecemos contratos de mantenimiento para comunidades y empresas.',
    phone: '+34 910 111 006', email: 'info@climacenter.example.com', website: 'https://climacenter.example.com',
    social: { facebook: 'https://facebook.com/climacentermadrid' }, hours: H_STD,
    rating: 4.6, reviews: 96, featured: false, photo: null,
  },
  {
    id: 'fontaneria-tetuan', name: 'Fontanería Tetuán',
    districtSlug: 'tetuan', neighborhoodSlug: 'cuatro-caminos',
    categorySlugs: ['fontaneros', 'calderas'], metroSlugs: ['cuatro-caminos', 'estrecho'],
    address: 'Calle de Bravo Murillo 200, 28020 Madrid',
    about: 'Fontaneros de confianza cerca de Cuatro Caminos. Reparación e instalación de calderas, calentadores y grifería. Atención rápida en todo el distrito de Tetuán.',
    phone: '+34 910 111 007', email: 'contacto@fontaneriatetuan.example.com', website: 'https://fontaneriatetuan.example.com',
    social: {}, hours: H_STD,
    rating: 4.5, reviews: 74, featured: false, photo: null,
  },
  {
    id: 'electrohogar-arganzuela', name: 'ElectroHogar Arganzuela',
    districtSlug: 'arganzuela', neighborhoodSlug: 'legazpi',
    categorySlugs: ['electricistas', 'instalaciones-electricas', 'iluminacion'], metroSlugs: ['legazpi'],
    address: 'Paseo de las Delicias 90, 28045 Madrid',
    about: 'Electricistas para el hogar y pequeños comercios en Arganzuela. Cuadros eléctricos, puntos de luz, domótica básica e iluminación LED. Presupuesto sin compromiso.',
    phone: '+34 910 111 008', email: 'info@electrohogar.example.com', website: 'https://electrohogar.example.com',
    social: {}, hours: H_STD,
    rating: 4.4, reviews: 63, featured: false, photo: null,
  },
  {
    id: 'clima-calor-latina', name: 'Clima&Calor Latina',
    districtSlug: 'latina', neighborhoodSlug: 'aluche',
    categorySlugs: ['climatizacion', 'calefaccion', 'bombas-de-calor'], metroSlugs: ['aluche'],
    address: 'Avenida de los Poblados 15, 28047 Madrid',
    about: 'Especialistas en calefacción y aerotermia en el distrito de Latina. Instalamos y reparamos calderas, radiadores y bombas de calor con máxima eficiencia energética.',
    phone: '+34 910 111 009', email: 'info@climacalorlatina.example.com', website: 'https://climacalorlatina.example.com',
    social: {}, hours: H_STD,
    rating: 4.5, reviews: 71, featured: false, photo: null,
  },
];

/* --------------------------- Seed helpers ---------------------------- */
function seedGeoIfEmpty() {
  if (DB.countDistricts() > 0) return false;
  GEO.districts.forEach((d, i) => {
    const dist = DB.insertDistrict(d.name, d.slug, i);
    (d.barrios || []).forEach(b => DB.insertNeighborhood(b.name, b.slug, dist.id));
  });
  console.log(`  ↳ Sembrada geografía de Madrid (${GEO.districts.length} distritos)`);
  return true;
}
function seedCategoriesIfEmpty() {
  if (DB.countCategories() > 0) return false;
  CATEGORIES.forEach((c, i) => {
    const parent = DB.insertCategory({ slug: c.slug, name: c.name, icon: c.icon, intro: c.intro, display_order: i, in_nav: 1 });
    (c.children || []).forEach((s, j) => DB.insertCategory({ slug: s.slug, name: s.name, parentId: parent.id, display_order: j, in_nav: 1 }));
  });
  console.log(`  ↳ Sembradas ${CATEGORIES.length} categorías de servicios`);
  return true;
}
/* Idempotent: se asigură că toate categoriile din CATEGORIES există și au
   ordinea corectă. Rulează la fiecare boot (și pe DB deja populate: SQLite pe
   disc, Supabase). Adaugă doar ce lipsește; nu șterge nimic. Returnează
   numărul de modificări (inserări + reordonări) → apelantul decide dacă
   trebuie să persiste în Postgres. */
function ensureCategories() {
  let changed = 0;
  CATEGORIES.forEach((c, i) => {
    let parent = DB.getCategoryBySlug(c.slug);
    if (!parent) {
      parent = DB.insertCategory({ slug: c.slug, name: c.name, icon: c.icon, intro: c.intro, display_order: i, in_nav: 1 });
      changed++;
    } else if (parent.display_order !== i) {
      DB.updateCategory(parent.id, { display_order: i });
      changed++;
    }
    (c.children || []).forEach((s, j) => {
      const existing = DB.getCategoryBySlug(s.slug);
      if (!existing) {
        DB.insertCategory({ slug: s.slug, name: s.name, parentId: parent.id, display_order: j, in_nav: 1 });
        changed++;
      } else if (existing.display_order !== j) {
        DB.updateCategory(existing.id, { display_order: j });
        changed++;
      }
    });
  });
  if (changed) console.log(`  ↳ Categorías sincronizadas (${changed} cambios)`);
  return changed;
}

/* Idempotent: adaugă cele 178 de municipios ale Comunidad de Madrid (pe lângă
   cele 21 de distritos ale capitalei). Rulează la fiecare boot, inclusiv pe DB
   deja populate (SQLite pe disc, Supabase) — de aceea NU folosim seedIfEmpty,
   care se oprește când există deja distritos. Inserează doar ce lipsește;
   display_order 100+ îi păstrează după distritos, grupați pe zonă. Returnează
   numărul de inserări → apelantul decide dacă trebuie să persiste în Postgres. */
function ensureMunicipios() {
  let changed = 0;
  MUNIS.municipios.forEach((m, i) => {
    let dist = DB.getDistrictBySlug(m.slug);
    if (!dist) { dist = DB.insertDistrict(m.name, m.slug, 100 + i); changed++; }
    // Barrios reales de los municipios principales (los pequeños no tienen).
    (BARRIOS[m.slug] || []).forEach(b => {
      if (!DB.getNeighborhoodBySlug(dist.id, b.slug)) {
        DB.insertNeighborhood(b.name, b.slug, dist.id);
        changed++;
      }
    });
  });
  if (changed) console.log(`  ↳ Municipios/barrios de la Comunidad de Madrid sincronizados (${changed})`);
  return changed;
}

function seedMetrosIfEmpty() {
  if (DB.countMetros() > 0) return false;
  METROS.forEach(m => DB.insertMetro({ name: m.name, lines: m.lines }));
  console.log(`  ↳ Sembradas ${METROS.length} estaciones de metro`);
  return true;
}

function tsInMonth(delta, nowD) {
  const base = new Date(nowD.getFullYear(), nowD.getMonth() - delta, 1);
  const start = base.getTime();
  const end = delta === 0 ? nowD.getTime() : new Date(nowD.getFullYear(), nowD.getMonth() - delta + 1, 1).getTime();
  return Math.floor((start + Math.random() * (end - start)) / 1000);
}
function seedEvents() {
  DB.clearEvents();
  const nowD = new Date();
  const visits = { 6: 468, 5: 552, 4: 610, 3: 703, 2: 795, 1: 910, 0: 214 };
  const ids = DB.listBusinesses({ limit: 4 }).map(b => b.id);
  const viewCounts = [1240, 980, 760, 540];
  const views = {}; ids.forEach((id, i) => { views[id] = viewCounts[i] || 400; });
  const contactPhone = 342, contactWeb = 289;
  DB.db.exec('BEGIN');
  try {
    Object.keys(visits).forEach(delta => { const d = Number(delta), n = visits[delta]; for (let i = 0; i < n; i++) DB.recordEvent('visit', null, tsInMonth(d, nowD)); });
    Object.keys(views).forEach(id => { for (let i = 0; i < views[id]; i++) DB.recordEvent('view', id, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD)); });
    for (let i = 0; i < contactPhone; i++) DB.recordEvent('contact_phone', null, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD));
    for (let i = 0; i < contactWeb; i++) DB.recordEvent('contact_web', null, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD));
    DB.db.exec('COMMIT');
  } catch (e) { DB.db.exec('ROLLBACK'); throw e; }
  console.log('  ↳ Sembrado histórico de analítica (demo)');
}

function seedIfEmpty() {
  const seededGeo = seedGeoIfEmpty();
  const seededCategories = seedCategoriesIfEmpty();
  const seededMetros = seedMetrosIfEmpty();
  const seededBusinesses = DB.countBusinesses() === 0;
  if (seededBusinesses) {
    DEMO_BUSINESSES.forEach(b => DB.insertBusiness(b, b.id));
    console.log(`  ↳ Sembrados ${DEMO_BUSINESSES.length} negocios demo`);
  }
  if (seededBusinesses || DB.countEvents() === 0) seedEvents();
  return { seededGeo, seededCategories, seededMetros, seededBusinesses };
}

module.exports = { seedIfEmpty, ensureCategories, ensureMunicipios, DEMO_BUSINESSES, CATEGORIES, METROS };
