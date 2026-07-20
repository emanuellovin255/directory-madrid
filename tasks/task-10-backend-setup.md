# Task 10 — Setup backend (Express + structură) ✅

**Status:** ✅ Gata

## Obiectiv
Schela aplicației full-stack: server Node/Express care servește frontend-ul din `public/` și un API.

## Fișiere
- `package.json` (deps: `express`, `cookie-session`; script `start`)
- `server/server.js`, `server/db.js`, `server/seed.js`
- `public/` (frontend mutat aici)
- `.env.example`, `.gitignore`

## Checklist
- [ ] `npm install` reușește (doar deps pure-JS)
- [ ] Express servește `public/` + fișierele din `uploads/`
- [ ] Loader `.env` (manual, fără dependență) cu valori implicite sigure
- [ ] `npm start` pornește serverul pe portul din `.env` (implicit 3000)
