# Task 19 — Import automat din URL (crawler fără AI) ✅

**Status:** ✅ Gata · **Faza 3**

## Implementat
- **`server/extract.js`** — crawler same-origin (BFS, max ~25 pagini, prioritizează
  contacto/servicios/horario/sobre-nosotros) + extractor determinist **fără AI, zero dependențe noi**
  (doar `fetch` nativ Node 24 + parsing propriu). Respectă `robots.txt`, concurență 3, timeout 12s/pagină,
  limită de mărime a paginii, User-Agent propriu, mic delay între loturi.
- **Prioritate extragere:** JSON-LD (`Dentist`/`LocalBusiness`/…) → linkuri `tel:`/`mailto:` →
  meta/Open Graph → euristici de text validate (telefon ES, email, cod poștal `28xxx`, orar, servicii).
- **Per câmp:** logo (JSON-LD → apple-touch-icon/icon → og:image → `<img>` „logo"; se **descarcă în `uploads/`**),
  orar (`openingHoursSpecification` → text), telefon/email (normalizate + validate strict), adresă
  (`PostalAddress` → regex stradă+CP), servicii (potrivite cu `SERVICE_CATALOG`, doar recunoscute),
  descriere (`description`/OG/primul paragraf), rețele (`sameAs`), valorare (`aggregateRating`),
  zonă/barrio (din adresă/descriere, listă cartiere Madrid).
- **Scor de încredere (alta/media/baja) + sursa + metoda** pentru fiecare câmp.
- **Endpoint** `POST /api/extract { url }` (protejat cu `requireAuth`) → `{ fields, confidence, pagesCrawled, pages, notes }`.
- **UI admin:** buton **„Importar desde URL"** → modal cu input + spinner de progres → **pre-completează
  drawer-ul** „Nueva clínica (importada)" + panou-rezumat cu câmpurile extrase, încrederea și sursa.
  **Nu se salvează automat** — admin revizuiește și apasă Guardar. Câmpurile nesigure rămân goale.
- Verificat end-to-end (site sintetic de test): 12 câmpuri extrase corect, URL invalid → 400,
  host inaccesibil → răspuns gol grațios (fără crash).

## Obiectiv
În admin, introduci **URL-ul site-ului** unei clinici → sistemul face **crawl pe tot site-ul (20–30 pagini,
same-domain)** și extrage automat, **fără AI**: **logo, orar, telefon, email, locație/adresă, servicii și o
scurtă descriere**. Datele trebuie să fie **exacte** → nu se salvează automat, ci **pre-completează
formularul** „Nueva clínica" pentru revizuire de către admin înainte de salvare.

## Principii de acuratețe (fără AI — extragere deterministă)
Ordine de prioritate (de la cel mai sigur la cel mai euristic):
1. **Date structurate (cele mai exacte):** `JSON-LD` schema.org (`Dentist` / `LocalBusiness` /
   `MedicalClinic` / `DentalClinic`) → `name`, `address` (PostalAddress), `telephone`, `email`,
   `openingHoursSpecification`, `logo`, `description`, `sameAs` (rețele sociale). Apoi **microdata**
   (`itemprop`) și **RDFa**.
2. **Linkuri semantice:** `tel:` → telefon, `mailto:` → email (cele mai sigure surse).
3. **Meta / Open Graph:** `og:site_name`, `og:title`, `og:description` / `<meta name=description>`, `og:image`.
4. **Euristici de text (ultima soluție), cu validare strictă:** regex pentru telefon ES (`+34…`), email,
   cod poștal (`28xxx`), ore (`L–V HH:MM`), nume de zile.

Per câmp:
- **Logo:** JSON-LD `logo` → `apple-touch-icon` / `link[rel=icon]` → `og:image` → `<img>` din header cu
  `alt`/clasă care conține „logo". Se **descarcă și se salvează în `uploads/`** (reutilizează pipeline-ul de upload).
- **Orar:** `openingHoursSpecification` (ideal) → text lângă „horario/horarios" cu zile + `HH:MM`.
- **Telefon/Email:** `tel:`/`mailto:` întâi; apoi regex, cu **normalizare** (spații, prefix +34) și **dedupe**.
- **Locație/adresă:** `PostalAddress` din JSON-LD → pagină „contacto/donde-estamos" → iframe Google Maps
  (place/coords) → regex stradă + cod poștal.
- **Servicii:** paginile „servicios/tratamientos" + meniul de navigație; heading-uri (h1–h3) și liste;
  **potrivire cu dicționarul `DDM.SERVICE_CATALOG`** ca să evităm zgomotul (păstrăm doar servicii recunoscute
  + eventual candidați marcați „de revizuit").
- **Descriere scurtă:** `meta description` / `og:description` / primul paragraf relevant de pe „sobre
  nosotros / quienes-somos".

## Crawler
- **Same-origin BFS**, max **20–30 pagini**, cu **prioritizarea paginilor utile** (contacto, servicios,
  tratamientos, sobre-nosotros, horario) după cuvinte-cheie din URL/anchor.
- **Politicos & legal:** respectă `robots.txt`, User-Agent propriu, timeout per pagină, **concurență limitată**
  (2–3), limită de mărime a paginii, mic delay între cereri. Doar HTTP(S) + HTML.

## Acuratețe / human-in-the-loop
- Fiecare câmp are **scor de încredere + sursa** (din ce pagină/metodă a fost extras).
- **Nu se salvează automat** — pre-completează drawer-ul de editare; admin verifică/corectează și salvează.
- Câmpurile nesigure **rămân goale** (mai bine gol decât greșit).
- Validare/normalizare pe telefon, email, cod poștal, format ore, URL logo.

## API / UX
- `POST /api/extract { url }` (protejat) → `{ fields:{logo,hours,phone,email,address,services[],description},
  sources, confidence, pagesCrawled }`.
- Admin: buton **„Importar desde URL"** → modal cu input URL + indicator de progres → **pre-completează
  formularul** „Nueva clínica".
- Operațiune posibil lungă (20–30 pagini) → spinner + timeout (ex. 30–60s), sau job cu polling dacă e nevoie.

## Tehnologii (fără AI)
Parser HTML (ex. **cheerio** — pur JS), `fetch` nativ Node, parsing **JSON-LD/microdata/OG**, regex.
**Zero LLM / zero AI.**

## Limitări cunoscute (de decis la implementare)
- Site-uri **fără date structurate** → unele câmpuri rămân goale (se completează manual).
- Site-uri **randate cu JS (SPA)** pot necesita un headless browser (ex. Playwright) pentru a vedea
  conținutul — de evaluat dacă e cazul (rămâne fără AI).
- `robots.txt` poate interzice crawl-ul unor secțiuni → le respectăm.

## Checklist
- [x] Crawler same-origin cu limite (20–30 pagini) + `robots.txt` + concurență/timeout
- [x] Extractor date structurate: JSON-LD + Open Graph (+ meta)
- [x] Extractoare per câmp: logo, telefon, email, adresă, orar, servicii, descriere
- [x] Scoruri de încredere + sursa per câmp
- [x] Endpoint `POST /api/extract` (protejat)
- [x] UI „Importar desde URL" care pre-completează formularul pentru **revizuire**
- [x] Validare/normalizare + **descărcare logo în `uploads/`**
- [x] Testare end-to-end (site sintetic) + edge cases (URL invalid, host inaccesibil)
