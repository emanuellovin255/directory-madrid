# Task 16 — Analytics real (tracking + stats) ✅

**Status:** ✅ Gata

## Obiectiv
Vizitatori reali agregați pe server (nu contor local pe browser).

## Fișiere
- `server/server.js`, `server/db.js`

## Checklist
- [ ] `POST /api/track/visit` — o vizită per sesiune (dedupe pe cookie de server)
- [ ] `POST /api/track/view/:id` și `POST /api/track/contact` (phone/web)
- [ ] `GET /api/stats` (protejat): total, luna curentă, creștere, serie lunară, top clinici, contacte
- [ ] Agregare din tabelul `events` (SQL GROUP BY pe lună)
