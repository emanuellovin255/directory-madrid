# Contactarea firmelor din director (revendicare gratuită)

Scop: firmele deja listate își revendică fișa. Fiecare fișă revendicată primește o descriere scrisă de firmă, deci conținut unic care poate fi indexat. Pe deasupra, e un lead cald pentru Listo247.

## Regula legală (Spania)

**LSSI art. 21:** în Spania nu ai voie să trimiți mesaje comerciale prin email, SMS sau WhatsApp fără acord prealabil. Regula se aplică și când destinatarul e o firmă. Ordinea corectă:

1. **Apel telefonic** (permis către firme).
2. Linkul îl trimiți pe WhatsApp sau email **doar după ce persoana spune „da”** la telefon.
3. Notezi acordul în GHL (dată + canal).

## Lista de apeluri

```bash
node scripts/export-profiles.js --sin-verificar --min-resenas=20 > fichas.csv
```

- Importă CSV-ul în GHL și potrivește contactele după telefon. Coloana `url_ficha` devine câmp personalizat.
- Lista e ordonată după numărul de reseñas. Începe cu firmele mai active: răspund mai des și au buget.
- Prioritate: meseriile cu pagină pereche pe listo247 (fontaneros, electricistas, cerrajeros, reformas, climatización, plagas, mudanzas).
- Pentru o singură meserie: `--categoria=fontaneros`.

## Scriptul de apel (spaniolă)

> Hola, ¿hablo con [nombre del negocio]? Le llamo de **Profesionales Madrid**, el directorio de profesionales de la Comunidad de Madrid. Su negocio ya aparece en el directorio, en la sección de [oficio] de [zona].
>
> Le llamo porque puede **reclamar la ficha gratis**: añade una descripción y sus servicios, sale con la insignia de verificado y aparece por delante de las fichas sin verificar de su zona. No cuesta nada ni tiene permanencia.
>
> ¿Le envío el enlace por WhatsApp para que lo vea? *(si dice que sí → anota el consentimiento)*

Dacă întreabă „¿de dónde han sacado mis datos?”:

> Son los datos públicos de su negocio en Google: nombre, teléfono, web y zona. Si prefiere que no aparezca, la quitamos ahora mismo.

Dacă cere ștergerea: o ștergi din admin pe loc și notezi în GHL „no contactar”.

**Verificarea:** chiar apelul acesta e verificarea. Dacă la numărul din fișă răspunde firma, poți aproba cererea în admin imediat ce o trimite.

## Mesaj WhatsApp (doar după „da”)

> Hola [nombre], soy Emanuel, de Profesionales Madrid. Como hablamos, este es el enlace a la ficha de [negocio]: [url_ficha]#reclamar
>
> Pulsa en «¿Es tu negocio? Reclama esta ficha gratis», escribe una descripción de tu negocio y te la publicamos verificada. Cualquier duda, por aquí.

## După aprobare (din admin → Leads → Reclamaciones → „Aprobar y publicar”)

> ¡Listo! Tu ficha ya sale verificada: [url_ficha]
>
> Si quieres, te paso un sello «Verificado en Profesionales Madrid» para tu web. Es opcional.

Codul insignei îl copiezi din editorul firmei (bifa „verificada” → „Copiar código”). Insigna e **opțională** și nu e niciodată condiție pentru listare. Linkul are ca text numele brandului, nu cuvinte-cheie.

## Trecerea spre Listo247

În apelul de verificare sau la 1–2 săptămâni după aprobare:

> Por cierto, he mirado su ficha de Google y en [barrio] sale en el puesto [X] cuando alguien busca [oficio]. ¿Le interesa que le enseñe cómo subirla? Lo hacemos desde Listo247, la empresa que está detrás del directorio.

## Povești (lead magnet 2)

Firmele cu un profil interesant (mulți ani în meserie, specializare clară, poze bune) primesc oferta de poveste gratuită. Procesul e în `docs/historias.md`.
