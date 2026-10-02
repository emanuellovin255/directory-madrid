/* =========================================================================
   content/profesionales.js — Textos de /profesionales y /profesionales/<oficio>.

   Público: el PROFESIONAL (no el cliente). Cada oficio tiene texto propio:
   qué mira el cliente de ese oficio antes de llamar y qué conviene poner en la
   ficha. Si dos páginas dicen lo mismo, Google se queda con una y tira la otra.

   `listo247` = slug de la página pareja en listo247.es (gestión de la ficha
   de Google para ese oficio). `anchor` = texto del enlace hacia ella.
   ========================================================================= */
'use strict';

const UPDATED = '2026-10-02';

const OFICIOS = {
  fontaneros: {
    listo247: 'fontaneros-madrid',
    anchor: 'cómo conseguir más avisos siendo fontanero en Madrid',
    h1: 'Fontaneros: tu ficha gratis en el directorio de Madrid',
    lead: 'Quien tiene una fuga no compara diez webs. Llama al primero que le da confianza: nombre real, zona cercana y teléfono que contesta.',
    puntos: [
      { t: 'Las urgencias se deciden en un minuto', d: 'Una ficha verificada, con tu zona y tu horario reales, se distingue de los call centers que revenden el aviso. El cliente ve que llama a un fontanero de su barrio, no a una centralita.' },
      { t: 'Di qué haces, no solo «fontanería»', d: 'Desatascos, fugas, calentadores, bajantes, reformas de baño. Quien busca «cambiar calentador» tiene que encontrarlo escrito en tu ficha.' },
      { t: 'Horario de urgencias claro', d: 'Si atiendes por la noche o en fin de semana, ponlo. Es lo primero que mira quien tiene el pasillo encharcado a las once de la noche.' },
    ],
    faq: [
      { q: '¿Puedo indicar que hago urgencias 24 horas?', a: 'Sí. Escríbelo en la descripción y en el horario al reclamar la ficha. Solo pedimos que sea verdad: si un cliente llama a las tres de la mañana, tiene que contestar alguien.' },
    ],
  },
  electricistas: {
    listo247: 'electricistas-madrid',
    anchor: 'más clientes para electricistas en Madrid',
    h1: 'Electricistas: aparece gratis en el directorio de Madrid',
    lead: 'Para un boletín o una avería, el cliente quiere saber una cosa antes que el precio: que eres instalador autorizado.',
    puntos: [
      { t: 'Que se vea que estás habilitado', d: 'Indica en tu descripción que eres empresa instaladora habilitada y que emites el certificado de instalación eléctrica (el boletín). Es la pregunta que te harán por teléfono de todas formas.' },
      { t: 'Separa averías de instalaciones', d: 'No es el mismo cliente el que se ha quedado sin luz que el que reforma un piso entero. Cuenta los dos servicios por separado para aparecer en las dos búsquedas.' },
      { t: 'Zonas concretas', d: 'Madrid es grande y nadie quiere pagar una hora de desplazamiento. Di en qué distritos o municipios trabajas de verdad.' },
    ],
    faq: [
      { q: '¿Tengo que poner mi número de instalador?', a: 'No es obligatorio, pero ayuda. Si lo incluyes en la descripción, el cliente lo ve antes de llamarte y te ahorra explicaciones.' },
    ],
  },
  cerrajeros: {
    listo247: 'cerrajeros-madrid',
    anchor: 'captar clientes siendo cerrajero en Madrid',
    h1: 'Cerrajeros: ficha gratis y verificada en el directorio de Madrid',
    lead: 'Es el oficio con más desconfianza del sector: todo el mundo ha oído una historia de una apertura que costó 400 euros. Una ficha verificada juega a tu favor.',
    puntos: [
      { t: 'La verificación pesa más que en ningún otro oficio', d: 'La insignia ✓ dice que hemos hablado contigo y que el teléfono es tuyo. Frente a anuncios sin nombre, es lo que hace que el cliente llame.' },
      { t: 'Precio orientativo y desplazamiento', d: 'No hace falta una tarifa cerrada, pero sí decir cómo cobras: desplazamiento, apertura simple, cambio de bombín. La claridad vende más que el precio bajo.' },
      { t: 'Dónde estás de verdad', d: 'Pon tu zona real. Un cerrajero de Carabanchel que dice cubrir «toda España» genera la desconfianza que intentas evitar.' },
    ],
    faq: [
      { q: '¿Puedo poner precios en la ficha?', a: 'Sí, en la descripción. Recomendamos orientativos («apertura sin rotura desde…») y dejar claro qué suma el desplazamiento o la noche.' },
    ],
  },
  reformas: {
    listo247: 'reformas-madrid',
    anchor: 'conseguir más obras para empresas de reformas en Madrid',
    h1: 'Empresas de reformas: aparece gratis en el directorio de Madrid',
    lead: 'Una reforma se compara durante semanas. El cliente guarda tres o cuatro empresas y elige por lo que ve: trabajos, plazos y cómo se explica cada una.',
    puntos: [
      { t: 'Las fotos hacen la mitad del trabajo', d: 'Al verificar la ficha puedes mandarnos fotos de obras terminadas (antes y después). Un baño acabado convence más que cualquier eslogan.' },
      { t: 'Qué tipo de reformas haces', d: 'Integrales, baños, cocinas, locales. Si solo haces baños, dilo: el cliente que busca una cocina no te va a llamar por error y el que busca baño te encuentra antes.' },
      { t: 'Licencias y plazos', d: 'Explica si gestionas la licencia o la declaración responsable y cuánto suele durar cada tipo de obra. Son las dos dudas que frenan a quien está comparando.' },
    ],
    faq: [
      { q: '¿Puedo añadir fotos de mis obras?', a: 'Sí. Cuando te llamemos para verificar la ficha te pediremos fotos por WhatsApp o email y las subimos nosotros.' },
    ],
  },
  climatizacion: {
    listo247: 'aire-acondicionado-madrid',
    anchor: 'más instalaciones de aire acondicionado en Madrid',
    h1: 'Climatización: tu empresa gratis en el directorio de Madrid',
    lead: 'La demanda llega de golpe: la primera semana de calor de junio y el primer frío de noviembre. Quien tiene la ficha lista antes del pico se queda los avisos.',
    puntos: [
      { t: 'Prepárala antes de la temporada', d: 'Una ficha verificada en mayo trabaja para ti en julio. En plena ola de calor nadie tiene tiempo de comparar diez empresas.' },
      { t: 'Instalación, mantenimiento y reparación', d: 'Son tres búsquedas distintas. Cuenta qué haces de cada una y con qué marcas trabajas, porque el cliente suele buscar por la marca de su equipo.' },
      { t: 'Certificaciones visibles', d: 'Manipular gases fluorados exige certificado, y las instalaciones térmicas, empresa habilitada. Ponlo en tu descripción: distingue a una empresa seria de un instalador sin papeles.' },
    ],
    faq: [
      { q: '¿Sirve también para calefacción y calderas?', a: 'Sí. Indica en la descripción si trabajas calefacción, aerotermia o calderas además del aire acondicionado.' },
    ],
  },
  'control-de-plagas': {
    listo247: 'control-de-plagas-madrid',
    anchor: 'captar clientes para empresas de control de plagas en Madrid',
    h1: 'Control de plagas: aparece gratis en el directorio de Madrid',
    lead: 'Quien encuentra chinches o cucarachas en casa quiere dos cosas: que vayas rápido y que no se entere todo el edificio.',
    puntos: [
      { t: 'Registro oficial, a la vista', d: 'Las empresas que aplican biocidas deben estar inscritas en el registro oficial (ROESB). Indícalo en tu descripción: es una garantía que muchos clientes no saben que existe hasta que se la explicas.' },
      { t: 'Particulares, comunidades y negocios', d: 'Son clientes distintos con plazos distintos. Di a cuáles atiendes: un restaurante con una inspección encima busca otra cosa que una familia con hormigas.' },
      { t: 'Discreción y plazos', d: 'Furgoneta sin rotular, visita en el día, garantía del tratamiento. Si lo ofreces, cuéntalo: decide más llamadas que el precio.' },
    ],
    faq: [
      { q: '¿Puedo indicar las plagas que trato?', a: 'Sí. Al reclamar la ficha escribe en servicios cuáles tratas (chinches, cucarachas, roedores, termitas, palomas…). Así apareces en búsquedas más concretas.' },
    ],
  },
  mudanzas: {
    listo247: 'mudanzas-madrid',
    anchor: 'conseguir más mudanzas en Madrid',
    h1: 'Empresas de mudanzas: aparece gratis en el directorio de Madrid',
    lead: 'El cliente de mudanzas compara presupuestos con calma, pero elige por confianza: que no aparezcan sorpresas el día de la mudanza.',
    puntos: [
      { t: 'Presupuesto cerrado y seguro', d: 'Si das presupuesto cerrado y la mudanza va asegurada, ponlo en la primera línea. Es lo que más preocupa a quien va a meter su casa en un camión ajeno.' },
      { t: 'Locales, nacionales y guardamuebles', d: 'Cuenta qué tipos de mudanza haces y si tienes guardamuebles. Mucha gente busca las dos cosas a la vez.' },
      { t: 'Trámites en Madrid', d: 'Si gestionas la reserva de espacio en la vía pública para el camión, dilo. Es un trámite que el cliente no conoce y te diferencia.' },
    ],
    faq: [
      { q: '¿Puedo destacar que trabajo fuera de Madrid?', a: 'Sí. Indica en la descripción si haces mudanzas nacionales o internacionales además de las locales.' },
    ],
  },
  talleres: {
    listo247: 'talleres-madrid',
    anchor: 'más clientes para tu taller en Madrid',
    h1: 'Talleres: tu taller gratis en el directorio de Madrid',
    lead: 'Elegir taller es elegir en quién confías tu coche. El conductor mira cercanía, especialidad y, sobre todo, si le van a dar presupuesto antes de tocar nada.',
    puntos: [
      { t: 'Presupuesto previo por escrito', d: 'El cliente tiene derecho a un presupuesto escrito antes de la reparación. Recuérdalo en tu ficha: transmite que trabajas con las reglas claras.' },
      { t: 'Especialidad y marcas', d: 'Mecánica general, chapa y pintura, neumáticos, eléctrico, una marca concreta. Quien busca «taller Volkswagen en Getafe» tiene que verlo escrito.' },
      { t: 'Servicios que ahorran tiempo', d: 'Recogida y entrega del coche, prepararlo para la ITV, coche de sustitución. Si los ofreces, son razones de peso para elegirte a ti.' },
    ],
    faq: [
      { q: '¿Puedo indicar con qué marcas trabajo?', a: 'Sí. Escríbelo en servicios al reclamar la ficha (por ejemplo «especialistas en Volkswagen y Seat»).' },
    ],
  },
};

/* Preguntas comunes de /profesionales (y base de cada página de oficio). */
const FAQ = [
  { q: '¿Cuánto cuesta aparecer en el directorio?', a: 'Nada. La ficha y la verificación son gratis y no tienen permanencia. Los únicos espacios de pago son los marcados como «Patrocinado».' },
  { q: '¿Por qué mi negocio ya aparece si no lo he pedido?', a: 'Partimos de datos públicos de negocios: nombre, teléfono, web y zona, tal como figuran en Google. Puedes reclamar la ficha para completarla o pedirnos que la quitemos.' },
  { q: '¿Cómo comprobáis que soy el dueño?', a: 'Te llamamos al teléfono que aparece en la ficha. Si contestas tú o alguien del negocio, la verificamos y publicamos tus datos.' },
  { q: '¿Qué gano verificando mi ficha?', a: 'Sale con la insignia ✓ Verificado, con tu descripción y tus servicios, y aparece por delante de las fichas sin verificar de tu zona. Además, te damos una insignia para tu web.' },
  { q: '¿Puedo eliminar mi ficha?', a: 'Sí. Escríbenos desde la página de contacto y la retiramos.' },
  { q: '¿Quién está detrás del directorio?', a: 'Listo247, una empresa que gestiona fichas de Google para profesionales en Madrid. Estar en el directorio no te obliga a contratar nada.' },
];

module.exports = { OFICIOS, FAQ, UPDATED };
