# PLAN — Profesionales Madrid (profesionalesmadrid.es)

> **Estado:** full-stack en producción. SSR con Node + Express, SQLite en local y
> **Supabase Postgres** en Vercel. Directorio SEO de profesionales de reformas y
> servicios para el hogar en la Comunidad de Madrid. UI en español.
>
> Este proyecto **pivotó** desde un antiguo directorio de clínicas dentales; toda
> la lógica dental se ha retirado. Para arrancar, ver `README.md`; para desplegar,
> `DEPLOY-VERCEL.md`.

## Contexto
Directorio que conecta a usuarios con **profesionales de reformas y servicios para
el hogar** (fontaneros, electricistas, cerrajeros, climatización, control de plagas,
mudanzas, talleres, reformas) en los **179 municipios** de la Comunidad de Madrid y
los 21 distritos de la capital. Objetivo de negocio: **posicionar en Google** (SEO
programático) y **captar leads** (solicitudes de presupuesto) para los profesionales.

## Arquitectura
Servidor Express único (`server/server.js`, reexportado en `api/index.js` para Vercel).

- `server/server.js` — rutas SSR + API REST, auth (cookie-session), upload, analítica, leads.
- `server/render.js` — todo el HTML SSR con template literals (sin motor de plantillas): title/meta/canonical/OG/Twitter/JSON-LD únicos por página, internal linking denso, sitemap, robots.
- `server/db.js` — esquema y consultas SQLite (`node:sqlite`, sin dependencias nativas).
- `server/pgstore.js` — persistencia durable en Supabase Postgres (hidratar/volcar).
- `server/seed.js` — seed inicial (geografía, categorías, metros, negocios demo).
- `server/extract.js` — importador de negocios desde una URL (crawler sin IA).
- `server/notify.js` — notificación best-effort de leads (webhook / Telegram / email Resend, por env).
- `public/` — `admin.html`, `login.html`, `favicon.svg`, `assets/{css,js,img}`.
- `data/` — `madrid-geo.json`, `madrid-municipios.json`, `madrid-barrios.json`.

## Modelo de datos
`categories` (árbol vía `parent_id`) · `districts` (distritos + municipios; `kind`/`zona`
derivados del slug) · `neighborhoods` (barrios) · `metros` · `businesses` (con `logo`,
`photos[]`) · `business_categories` · `business_metros` · `placements` (orden manual por
contexto) · `events` (analítica, en memoria) · `leads` (solicitudes de presupuesto).

Modo de ejecución: con `DATABASE_URL` o en Vercel → SQLite `:memory:` + Postgres como
almacén durable; en local sin Supabase → SQLite en disco (`server/data.db`).

## Funcionalidades
- [x] Páginas SEO: home, categoría, categoría×distrito/municipio, ×barrio, ×metro, ×zona, ficha de negocio, zonas, metro, búsqueda, legales (RGPD/LSSI).
- [x] Ranking manual (drag & drop) por contexto; orden por defecto = shuffle determinista.
- [x] Logo + galería de servicios por negocio.
- [x] **Captación de leads**: formulario “Solicitar presupuesto” en la ficha y en las páginas de listado (incl. las vacías) → tabla `leads` → notificación (webhook/Telegram/email) → bandeja de entrada en `/admin`.
- [x] Panel de administración: CRUD de negocios, taxonomía, tablero de orden, estadísticas, bandeja de leads; import desde URL; export/import JSON.
- [x] Push server-to-server desde el CRM “100k MRR” (`POST /api/businesses` con `x-api-token`, permiso mínimo).
- [x] **Seguridad**: bloqueo del panel si `ADMIN_PASSWORD`/`SESSION_SECRET` están por defecto en producción; rate-limit de login; cabeceras de seguridad; token de API con permisos mínimos.
- [x] **SEO anti-thin**: `noindex,follow` en listados vacíos y en `/buscar`; sitemap solo con páginas con contenido + `<lastmod>` + caché.
- [x] Analítica (Plausible/GA4) opcional, cargada **solo tras el consentimiento** de cookies.
- [x] **Rebrand + dominio canónico** (`SITE_URL`): canonical/OG/JSON-LD/sitemap fijos y 301 desde *.vercel.app.
- [x] **Indexación limpia**: fichas sin contenido propio → `noindex,follow` (indexables al reclamarlas o con descripción ≥150); listados con < `MIN_LISTING` empresas → noindex; enlaces internos solo a páginas con empresas.
- [x] **Sitemap por tipos** (principales, servicios, distritos, municipios, barrios, metro, historias, negocios-N) + `SITEMAP_TYPES` para lanzar por olas.
- [x] **Funnel profesional**: `/profesionales` (+ 8 páginas por oficio), reclamar ficha desde la propia ficha, aprobación en el admin, insignia ✓ Verificado (sale antes en los listados) y sello SVG para su web.
- [x] **Historias de profesionales** (lead magnet 2): `/historias`, editor en el admin, tarjetas «Historia».
- [x] **Contenido**: textos propios por categoría y por categoría×distrito, 12 páginas `/precios`, 8 `/guias`, `/sobre-nosotros`, `/contacto`.
- [x] **Imágenes en Supabase Storage** (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`).
- [x] Scripts: `export-profiles.js` (CSV para GHL), `enrich-from-web.js` (dirección/horario/redes desde su web).

- [x] **Calidad de datos**: `scripts/prune-outside.js` quita negocios de fuera de la Comunidad (fijo de otra provincia, etiqueta de fuera, zona con mayoría de fijos de fuera); `import-leads.js` aplica la misma regla. Etiquetas genéricas sin municipio («Pueblo», «Casco Antiguo») ya no se muestran.
- [x] **Contenido local de municipios** (`content/municipios.js`, 30 municipios) en servicio×municipio y `/zona/<municipio>`.
- [x] **SEO técnico**: title/description con el nº real de empresas; `?page=` inexistente → 404; `/destacadas` noindex sin selección manual; JSON-LD escapado (`<` → `\u003c`); og:image correcta con Storage; hero WebP precargado; barrios del buscador bajo demanda; placeholders CSS.
- [x] **Analítica**: en producción sin estadísticas propias (ni llamadas ni cookie); clics de llamada/web como eventos `click_phone`/`click_web` en Plausible/GA4.

## Próximos pasos (ideas)
- Almacenar imágenes en object storage/CDN (hoy inline base64 en Postgres) con WebP + `srcset`.
- Contenido local único por municipio/barrio para que más páginas superen el umbral de indexación.
- Extender el tablero de orden a los contextos de metro/municipio/barrio que hoy solo tienen shuffle.
- Alta de profesionales (self-signup) — hoy es un “próximamente”.
