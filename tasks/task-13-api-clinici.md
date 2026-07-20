# Task 13 — API REST clinici (CRUD) ✅

**Status:** ✅ Gata

## Obiectiv
Endpoint-uri REST pentru clinici: citire publică, scriere protejată.

## Fișiere
- `server/server.js`

## Checklist
- [ ] `GET /api/clinics` (public, cu filtrare/sortare opțională server-side)
- [ ] `GET /api/clinics/:id` (public)
- [ ] `POST /api/clinics` (protejat) — creare cu slug unic
- [ ] `PUT /api/clinics/:id` (protejat)
- [ ] `DELETE /api/clinics/:id` (protejat)
- [ ] `POST /api/clinics/:id/featured` (protejat) — toggle
- [ ] `GET /api/export` / `POST /api/import` (protejat) — backup JSON
