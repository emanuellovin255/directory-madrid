# Task 11 — Bază de date SQLite (schema + queries) ✅

**Status:** ✅ Gata

## Obiectiv
Persistență reală într-un fișier SQLite (`node:sqlite`, built-in Node 24 — fără dependență nativă).

## Fișiere
- `server/db.js`

## Checklist
- [ ] Tabel `clinics` (câmpuri JSON pentru services/hours/social)
- [ ] Tabel `events` (type: visit/view/contact_phone/contact_web, ref, ts) pentru analytics
- [ ] Funcții: listClinics/getClinic/insert/update/remove/toggleFeatured
- [ ] Funcții agregare: monthly visits, top views, contacts, totals
- [ ] DB creat automat la prima pornire (`server/data.db`)
