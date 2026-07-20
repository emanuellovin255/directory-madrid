# Task 14 — Autentificare admin reală ✅

**Status:** ✅ Gata

## Obiectiv
Login real pentru admin (nu doar o parolă ascunsă pe client).

## Fișiere
- `server/server.js`
- `public/login.html`

## Checklist
- [ ] Sesiune pe **cookie semnat** (`cookie-session`, httpOnly, sameSite=lax)
- [ ] Credențiale din `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`), comparație `timingSafeEqual`
- [ ] `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] Middleware `requireAuth` pe toate rutele de scriere
- [ ] Pagină `login.html`; `admin.html` redirecționează dacă nu ești autentificat
