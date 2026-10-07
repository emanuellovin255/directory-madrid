#!/usr/bin/env node
/* =========================================================================
   prune-outside.js — Quita del directorio los negocios que NO están en la
   Comunidad de Madrid.

   El scraper de los leads empareja nombres de lugar «a ojo»: «Salamanca»
   (la ciudad) acaba en el distrito de Salamanca, «La Acebeda» recoge negocios
   de Jaén, «Isla de Valdecañas» es Cáceres… Se detectan así:

   1. Fijo de otra provincia (9x/8x con x ≠ 1; 91/81 = Madrid) → fuera.
   2. Móvil (o 90x) con una etiqueta de zona que está fuera de la Comunidad
      (Guadalajara, Ávila, Toledo…) → fuera.
   3. Móvil en una zona donde la mayoría de los fijos son de otra provincia
      (≥ 2 fijos de fuera y ≥ 50 %) → la etiqueta está mal, fuera.
   Un fijo de Madrid (91/81) nunca se quita.

   Uso:
     node scripts/prune-outside.js            simulación + informe
     node scripts/prune-outside.js --apply    borra (copia de seguridad antes)
   Con DATABASE_URL trabaja sobre Supabase. import-leads.js aplica la misma
   regla, así que una reimportación no los vuelve a meter.
   ========================================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

/* Etiquetas (normalizadas con strict()) que están fuera de la Comunidad. */
const OUTSIDE_LABELS = new Set([
  'guadalajara', 'isla de valdecanas', 'hoyos del espino', 'algora', 'ciudad ducal',
  'san rafael', 'los angeles de san rafael', 'ventas de retamosa',
]);

const strict = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/* Teléfono → 'madrid' | 'fuera' | 'movil' | 'otro'. */
function phoneRegion(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
  if (d.length !== 9) return 'otro';
  if (/^[67]/.test(d)) return 'movil';
  if (/^[89]1/.test(d)) return 'madrid';
  if (/^[89][2-9]/.test(d)) return 'fuera';
  return 'otro';   // 80x/90x: numeración especial, sin provincia
}

/* items: [{ id, phone, zone, label }] — zone = slug del municipio/distrito o
   'area:<etiqueta>' si no tiene; label = etiqueta normalizada si no hay municipio.
   Devuelve Map(id → motivo). */
function outsideMadrid(items) {
  const stats = new Map();
  for (const it of items) {
    if (!it.zone) continue;
    const r = phoneRegion(it.phone);
    const s = stats.get(it.zone) || { mad: 0, fuera: 0 };
    if (r === 'madrid') s.mad++; else if (r === 'fuera') s.fuera++;
    stats.set(it.zone, s);
  }
  const out = new Map();
  for (const it of items) {
    const r = phoneRegion(it.phone);
    if (r === 'madrid') continue;
    if (r === 'fuera') { out.set(it.id, 'fijo de otra provincia'); continue; }
    if (it.label && OUTSIDE_LABELS.has(it.label)) { out.set(it.id, 'zona fuera de la Comunidad'); continue; }
    const s = it.zone && stats.get(it.zone);
    if (s && s.fuera >= 2 && s.fuera / (s.fuera + s.mad) >= 0.5) out.set(it.id, 'zona con mayoría de fijos de fuera');
  }
  return out;
}

/* ================================ CLI =================================== */
async function main() {
  (function loadEnv(file) {
    try {
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      });
    } catch { /* sin .env */ }
  })(path.join(__dirname, '..', '.env'));
  const DB = require('../server/db');
  const APPLY = process.argv.includes('--apply');

  await DB.initPersistence();
  const rows = DB.db.prepare(`SELECT b.id, b.name, b.phone, b.area, d.slug AS d FROM businesses b
    LEFT JOIN districts d ON d.id = b.district_id`).all();
  const items = rows.map(r => ({
    id: r.id, phone: r.phone,
    zone: r.d || (strict(r.area) ? 'area:' + strict(r.area) : null),
    label: r.d ? '' : strict(r.area),
  }));
  const out = outsideMadrid(items);

  const byReason = {}, byZone = {};
  const zoneOf = new Map(rows.map(r => [r.id, r.d || `[${r.area || 'sin zona'}]`]));
  for (const [id, why] of out) {
    byReason[why] = (byReason[why] || 0) + 1;
    const z = zoneOf.get(id); byZone[z] = (byZone[z] || 0) + 1;
  }
  console.log(`\nNegocios: ${rows.length} · fuera de la Comunidad de Madrid: ${out.size}`);
  Object.entries(byReason).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
  console.log('  Zonas más afectadas: ' + Object.entries(byZone).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([z, n]) => `${z} (${n})`).join(', '));

  if (!APPLY) { console.log('\n🧪 Simulación. Para borrar: node scripts/prune-outside.js --apply\n'); return; }
  if (!out.size) return;

  if (!DB.persistenceEnabled()) {
    const file = DB.db.prepare('PRAGMA database_list').all().find(x => x.name === 'main');
    if (file && file.file) {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
      const backup = file.file + '-backup-' + stamp;
      if (!fs.existsSync(backup)) DB.db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
      console.log(`💾 Copia de seguridad: ${path.relative(process.cwd(), backup)}`);
    }
  }
  DB.db.exec('BEGIN');
  try { for (const id of out.keys()) DB.removeBusiness(id); DB.db.exec('COMMIT'); }
  catch (e) { try { DB.db.exec('ROLLBACK'); } catch { /* ignora */ } throw e; }
  if (DB.persistenceEnabled()) {
    console.log('☁️  Guardando en Postgres (Supabase)…');
    await DB.persist({ allowShrink: true });
  }
  console.log(`✅ Borrados ${out.size}. Quedan ${DB.countBusinesses()} negocios.\n`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('✗ Error:', e); process.exit(1); });
}
module.exports = { phoneRegion, outsideMadrid, OUTSIDE_LABELS };
