# Task 22 — Ordine aleatorie + placements + paginare publică ✅

**Status:** ✅ Gata · **Faza 4 (clasament + poze)**

## Obiectiv
Ordinea implicită a listărilor = **aleatorie** (stabilă), dar adminul poate **fixa manual** ordinea per
context. Paginare **20/pagină** pe toate listările + pagină dedicată **`/destacadas`** și pagini noi
**nișă × zonă** (`/:categoria/zona/:zona`).

## Implementat
- **API (`server/server.js`)**
  - `GET/PUT/DELETE /api/placements/:context` (scrierile `requireAuth`); `GET` întoarce lista efectivă
    ordonată + `available` (pool pentru home). `parseContext` validează: `home`, `cat:<slug>`,
    `cat:<slug>:zona:<z>`, `cat:<slug>:mun:<d>` (context invalid → 400).
  - `GET /api/zones` (pentru selectorul de zone din admin).
  - Pagini SSR noi: `GET /destacadas` (`?page`), `GET /:categoria/zona/:zona` (înregistrat după
    `/:categoria/metro/:estacion`, înainte de `/:categoria/:distrito/:barrio`). `?page` propagat la toate
    randările de listare.
- **Client (`public/assets/js/api.js`)**: `getPlacements`, `setPlacements`, `clearPlacements`, `zones`.
- **Randare (`server/render.js`)**
  - `listingPage` extins cu paginare (slice 20/pagină, nav `.pagination` + `<link rel=prev/next>` +
    canonical `?page=N`).
  - Contexte aplicate: `renderCategory`→`cat:slug`; `renderDistrict`→`cat:slug:mun:d`; `renderBarrio`
    moștenește contextul municipiului; `renderCategoryZona` (nou)→`cat:slug:zona:z`; `renderMetroHub`/
    zone/căutare → shuffle stabil + paginare.
  - Home: „Empresas destacadas" = primele ~12 din `home` (fallback shuffle), „Ver todas"→`/destacadas`.
  - `renderDestacadas` (context `home`, membership, paginat). `renderSitemap` += `/destacadas` +
    nișă×zonă.
- `featured` rămâne doar **badge „Destacado"** (nu mai forțează ordinea).

## Verificat (curl + browser)
Toate rutele 200 (`/destacadas`, `?page=2`, `/electricistas/zona/sur`, `/electricistas/getafe`, …).
PUT clasament electricistas → ordinea se reflectă pe `/electricistas`; membership home → `/destacadas`
arată exact lista; DELETE → revine la shuffle (9 empresas fallback).
