/* =========================================================================
   content/categorias.js — Texto propio de cada página de servicio (/fontaneros…).

   Público: el CLIENTE que busca un profesional. Va debajo del listado (las
   empresas primero): intro, qué comprobar antes de contratar, precio
   orientativo (enlace a /precios), guías relacionadas y preguntas frecuentes.
   `porVivienda` alimenta las páginas servicio×distrito (ver distritos.js).
   ========================================================================= */
'use strict';

const CATEGORIAS = {
  reformas: {
    intro: [
      'Una reforma bien planteada empieza antes de la primera llamada: saber qué quieres cambiar, qué presupuesto manejas y si la obra necesita algún trámite en tu ayuntamiento. Con eso claro, los presupuestos que recibas serán comparables.',
      'Pide al menos tres presupuestos por partidas (demolición, fontanería, electricidad, alicatado, carpintería) y no solo un precio cerrado. Así ves dónde está la diferencia entre una empresa y otra, y qué incluye cada una.',
    ],
    checklist: [
      'Presupuesto por escrito y desglosado por partidas, con calidades y marcas.',
      'Plazo de ejecución y calendario de pagos ligado al avance de la obra.',
      'Quién gestiona la licencia o la declaración responsable y quién paga las tasas.',
      'Seguro de responsabilidad civil y garantía de los trabajos.',
      'Fotos o referencias de obras parecidas a la tuya.',
    ],
    precio: 'precio-reforma-integral-piso-madrid',
    guias: ['como-elegir-empresa-de-reformas', 'licencia-de-obra-madrid'],
    faq: [
      { q: '¿Cuánto tarda una reforma integral de un piso?', a: 'Para un piso de unos 80 m², lo habitual son entre dos y tres meses de obra, más el tiempo de trámites. Un baño o una cocina sueltos suelen estar en dos o tres semanas.' },
      { q: '¿Necesito licencia para reformar mi piso en Madrid?', a: 'Depende de la obra. En Madrid capital, la mayoría de reformas interiores se tramitan con una declaración responsable; las que tocan estructura, fachada o elementos comunes necesitan licencia. Lo explicamos en la guía sobre licencias de obra.' },
      { q: '¿Es mejor contratar por partidas o con una sola empresa?', a: 'Con una sola empresa tienes un único responsable y un calendario coordinado. Por partidas puedes ahorrar, pero la coordinación entre gremios pasa a ser cosa tuya.' },
    ],
    porVivienda: {
      antigua: 'En pisos antiguos, una reforma suele destapar fontanería y electricidad originales: conviene presupuestar su renovación desde el principio y no como imprevisto.',
      mixta: 'En los bloques de los años 60 y 70 lo más habitual es redistribuir cocina y baño, renovar instalaciones y cambiar ventanas para ganar aislamiento.',
      nueva: 'En vivienda reciente las reformas suelen ser parciales (cocina, suelos, armarios) y rara vez hace falta tocar las instalaciones.',
    },
  },
  fontaneros: {
    intro: [
      'Una fuga o un atasco no esperan. Lo primero es cortar la llave de paso y, si el agua llega al vecino de abajo, avisarle. Después, llama a un fontanero de tu zona: tardará menos y el desplazamiento será más barato.',
      'Para trabajos que no son urgentes, como cambiar un calentador, renovar tuberías o instalar un plato de ducha, compensa pedir dos o tres presupuestos y comparar qué incluye cada uno.',
    ],
    checklist: [
      'Precio del desplazamiento y de la primera hora antes de que venga.',
      'Recargo por urgencia, noche o festivo, si lo hay.',
      'Que dé factura y garantía de la reparación.',
      'Si cambia piezas, de qué marca y quién las aporta.',
      'Para obras grandes, presupuesto por escrito.',
    ],
    precio: 'precio-fontanero-madrid',
    guias: ['que-hacer-ante-una-fuga-de-agua'],
    faq: [
      { q: '¿Cuánto cobra un fontanero por venir a casa en Madrid?', a: 'La salida con la primera hora de trabajo suele estar entre 40 y 80 € en horario laborable. Por la noche o en festivo, el precio sube. Tienes los detalles en nuestra página de precios de fontanero.' },
      { q: '¿Quién paga una fuga que afecta al vecino?', a: 'Si la fuga sale de tu vivienda, normalmente responde tu seguro de hogar; si viene de una bajante o tubería común, el de la comunidad. Avisa al seguro antes de reparar y haz fotos.' },
      { q: '¿Un desatasco es cosa del fontanero?', a: 'Sí. Para atascos en fregaderos o lavabos basta un fontanero; si el atasco está en la bajante o la arqueta, a veces hace falta una empresa de desatascos con máquina o camión.' },
    ],
    porVivienda: {
      antigua: 'En edificios antiguos siguen apareciendo bajantes de fibrocemento o hierro y tuberías viejas que provocan buena parte de las fugas y atascos.',
      mixta: 'En los bloques de los años 60 y 70, los atascos en bajantes comunitarias y las averías de calentadores y termos son los avisos más habituales.',
      nueva: 'En vivienda reciente predominan las averías de grifería, cisternas y equipos de agua caliente, muchas veces aún en garantía.',
    },
  },
  electricistas: {
    intro: [
      'Si salta la luz y no vuelve, antes de llamar mira el cuadro: un diferencial o un automático bajado suele indicar qué línea falla. Si vuelve a saltar en cuanto lo subes, no insistas y llama a un electricista.',
      'Para el boletín eléctrico, una subida de potencia o una instalación nueva necesitas una empresa instaladora habilitada. Pregúntalo antes de cerrar el presupuesto.',
    ],
    checklist: [
      'Que sea empresa instaladora habilitada si el trabajo requiere boletín.',
      'Precio de la visita y de la hora, y recargo por urgencia.',
      'Materiales incluidos o aparte, y de qué marca.',
      'Factura y garantía del trabajo.',
      'Para reformas de instalación, que emita el certificado al terminar.',
    ],
    precio: 'precio-electricista-madrid',
    guias: ['boletin-electrico-cuando-es-obligatorio'],
    faq: [
      { q: '¿Qué es el boletín eléctrico?', a: 'Es el certificado de instalación eléctrica (CIE) que firma un instalador habilitado. Lo piden las comercializadoras para dar de alta la luz en ciertos casos o subir la potencia.' },
      { q: '¿Por qué salta el diferencial?', a: 'Suele ser una fuga de corriente en algún aparato o línea (humedad, un electrodoméstico averiado). Desenchufa todo, sube el diferencial y ve conectando aparatos hasta dar con el culpable.' },
      { q: '¿Puedo cambiar un enchufe yo mismo?', a: 'Un cambio simple de mecanismo es sencillo con la corriente cortada, pero cualquier modificación de la instalación debe hacerla un profesional.' },
    ],
    porVivienda: {
      antigua: 'Muchas instalaciones antiguas no tienen toma de tierra ni protecciones actuales: antes de subir potencia o meter horno y vitrocerámica, conviene revisar el cuadro.',
      mixta: 'En pisos de los años 60 y 70 es habitual que la instalación se quede corta para los electrodomésticos de hoy y que salten los automáticos.',
      nueva: 'En vivienda reciente, lo más pedido es añadir puntos de luz y enchufes, instalar cargadores de coche eléctrico o domótica.',
    },
  },
  climatizacion: {
    intro: [
      'Las empresas de climatización trabajan por temporadas: en plena ola de calor las agendas se llenan y los plazos se alargan. Si puedes, pide presupuesto en primavera para el aire y a final de verano para la calefacción.',
      'Al comparar, fíjate en la potencia del equipo (frigorías o kW) para el tamaño de la habitación, la eficiencia energética y si la instalación incluye soportes, línea frigorífica y desagüe.',
    ],
    checklist: [
      'Potencia adecuada a los metros y la orientación de la estancia.',
      'Qué incluye la instalación: metros de línea, soportes, desagüe y remates.',
      'Empresa habilitada y técnico con certificado de gases fluorados.',
      'Garantía del equipo y de la instalación, por separado.',
      'Si la unidad exterior necesita permiso de la comunidad.',
    ],
    precio: 'precio-instalar-aire-acondicionado-madrid',
    guias: [],
    faq: [
      { q: '¿Cuántas frigorías necesito?', a: 'Como orientación, unas 100 frigorías por m² en una estancia normal; más si da al sol de tarde o está bajo cubierta. El instalador debería calcularlo en la visita.' },
      { q: '¿Necesito permiso de la comunidad para poner el aire?', a: 'Si la unidad exterior va en fachada o en elementos comunes, normalmente sí. Revisa los estatutos o pregunta al administrador antes de instalar.' },
      { q: '¿Cada cuánto hay que hacer mantenimiento?', a: 'Limpieza de filtros cada pocas semanas en temporada (la puedes hacer tú) y una revisión profesional al año.' },
    ],
    porVivienda: {
      antigua: 'En fincas antiguas, colocar la unidad exterior en fachada o patio suele requerir permiso de la comunidad: pregúntalo antes de pedir presupuesto.',
      mixta: 'En los bloques de los años 60 y 70, el split en dormitorios y salón es la solución más común; en edificios con calefacción central, el aire va aparte.',
      nueva: 'Muchas viviendas nuevas traen preinstalación de conductos: aprovecharla abarata bastante la instalación.',
    },
  },
  cerrajeros: {
    intro: [
      'Si te quedas fuera de casa, pide el precio cerrado de la apertura por teléfono antes de que el cerrajero se desplace, y pregunta si habrá que romper o cambiar el bombín. Desconfía de quien no da precio hasta llegar.',
      'Para mejorar la seguridad sin urgencias, un bombín antibumping o una cerradura de varios puntos suelen ser más rentables que cambiar la puerta entera.',
    ],
    checklist: [
      'Precio de la apertura cerrado por teléfono, con desplazamiento incluido.',
      'Recargo por noche o festivo, dicho antes.',
      'Si la apertura es sin rotura o habrá que cambiar el bombín.',
      'Marca y modelo de las piezas que instale.',
      'Factura con sus datos fiscales.',
    ],
    precio: 'precio-cerrajero-madrid',
    guias: ['como-evitar-estafas-cerrajeros'],
    faq: [
      { q: '¿Cuánto cuesta abrir una puerta en Madrid?', a: 'Una apertura sin rotura en horario laborable suele estar entre 80 y 150 €. De noche o en festivo puede subir bastante. Lo detallamos en la página de precios de cerrajero.' },
      { q: '¿Qué es un bombín antibumping?', a: 'Un cilindro preparado contra el bumping, una técnica para abrir cerraduras sin dejar marcas. Es una de las mejoras de seguridad más baratas.' },
      { q: '¿El seguro de hogar cubre el cerrajero?', a: 'Muchas pólizas incluyen la apertura de puerta por pérdida de llaves. Llama primero a tu aseguradora: a veces te envían su propio profesional.' },
    ],
    porVivienda: {
      antigua: 'Las puertas de madera antiguas admiten blindaje o una cerradura de seguridad, normalmente por menos dinero que una puerta acorazada nueva.',
      mixta: 'En los bloques de los años 60 y 70 abundan las cerraduras de un solo punto: cambiar el bombín por uno antibumping es la mejora más rentable.',
      nueva: 'En vivienda nueva las puertas suelen ser blindadas; lo más común es cambiar el bombín al entrar a vivir o duplicar llaves de seguridad.',
    },
  },
  'control-de-plagas': {
    intro: [
      'Cucarachas, chinches, roedores o termitas no se van solos, y los productos de supermercado suelen esconder el problema unas semanas. Una empresa de control de plagas identifica la especie y aplica el tratamiento adecuado.',
      'Si vives en un bloque, avisa al administrador: muchas plagas se mueven por bajantes y patios, y el tratamiento solo funciona si se hace en las zonas comunes.',
    ],
    checklist: [
      'Empresa inscrita en el registro oficial de servicios biocidas (ROESB).',
      'Diagnóstico de la plaga antes de dar precio cerrado.',
      'Número de visitas incluidas y garantía del tratamiento.',
      'Plazo de seguridad: cuándo puedes volver a casa, con niños o mascotas.',
      'Certificado del tratamiento, necesario en negocios y comunidades.',
    ],
    precio: 'precio-control-de-plagas-madrid',
    guias: ['chinches-y-cucarachas-en-casa'],
    faq: [
      { q: '¿Cuántas visitas hacen falta para las cucarachas?', a: 'Con gel insecticida suele bastar una aplicación y una revisión a las pocas semanas. Las chinches necesitan normalmente dos tratamientos.' },
      { q: '¿Es peligroso para niños y mascotas?', a: 'Los tratamientos profesionales indican un plazo de seguridad. Sigue las instrucciones de la empresa y pide la ficha del producto si tienes dudas.' },
      { q: '¿Quién paga la desratización del edificio?', a: 'Si la plaga está en zonas comunes, la comunidad. Si es solo en tu vivienda, tú (o tu seguro, si lo cubre).' },
    ],
    porVivienda: {
      antigua: 'En edificios antiguos, cucarachas y roedores se mueven por bajantes y patios: el tratamiento funciona mejor si lo contrata la comunidad.',
      mixta: 'En los bloques de los años 60 y 70, las cucarachas vuelven si no se tratan también los cuartos de basuras y las zonas comunes.',
      nueva: 'En zonas nuevas, junto a solares y parques, son más habituales los roedores y los insectos en jardines y garajes.',
    },
  },
  mudanzas: {
    intro: [
      'Una mudanza sin sorpresas empieza con una visita o una videollamada para que la empresa vea el volumen real. Un presupuesto «a ojo» por teléfono suele crecer el día de la mudanza.',
      'Pregunta si el precio es cerrado, qué seguro cubre los muebles y si incluye desmontaje, embalaje y montaje. Y reserva con tiempo si te mudas en verano o a final de mes.',
    ],
    checklist: [
      'Presupuesto cerrado por escrito tras ver el volumen.',
      'Seguro de la mercancía y qué cubre exactamente.',
      'Desmontaje, embalaje y montaje incluidos o aparte.',
      'Si gestionan la reserva de espacio para el camión.',
      'Fecha y franja horaria confirmadas por escrito.',
    ],
    precio: 'precio-mudanza-madrid',
    guias: ['mudanza-en-madrid'],
    faq: [
      { q: '¿Cuánto cuesta una mudanza dentro de Madrid?', a: 'Un piso de uno o dos dormitorios suele estar entre 300 y 700 €, según volumen, plantas y ascensor. Lo detallamos en la página de precios de mudanzas.' },
      { q: '¿Con cuánta antelación reservo?', a: 'Dos o tres semanas en temporada normal; un mes o más en julio, agosto y final de mes.' },
      { q: '¿Hay que pedir permiso para aparcar el camión?', a: 'En muchas calles de Madrid conviene reservar espacio en la vía pública. Muchas empresas lo gestionan por ti.' },
    ],
    porVivienda: {
      antigua: 'En calles estrechas y edificios sin ascensor, la mudanza suele necesitar elevador exterior o más operarios: díselo a la empresa al pedir presupuesto.',
      mixta: 'En bloques con ascensor pequeño, los muebles grandes se desmontan: incluir el montaje en el presupuesto evita sorpresas.',
      nueva: 'En urbanizaciones nuevas con garaje, el acceso del camión suele ser fácil, pero conviene avisar a la comunidad del día y la hora.',
    },
  },
  talleres: {
    intro: [
      'Elegir taller es elegir en quién confías tu coche. Antes de dejarlo, pide presupuesto por escrito: es tu derecho y te protege si la factura final no cuadra.',
      'Un taller de barrio con buenas reseñas suele ser más barato que el concesionario para el mantenimiento y las reparaciones habituales, y mantiene la garantía del fabricante si usa recambios homologados y sigue el plan de mantenimiento.',
    ],
    checklist: [
      'Presupuesto por escrito antes de la reparación.',
      'Recambios originales o equivalentes homologados.',
      'Garantía de la reparación y del recambio.',
      'Factura detallada (piezas y horas de mano de obra).',
      'Hoja de reclamaciones disponible, como exige la normativa.',
    ],
    precio: 'precio-cambio-aceite-taller-madrid',
    guias: ['derechos-en-el-taller'],
    faq: [
      { q: '¿Pierdo la garantía si no voy al concesionario?', a: 'No, siempre que el taller siga el plan de mantenimiento del fabricante y use recambios de calidad equivalente. Guarda las facturas.' },
      { q: '¿Me pueden cobrar el presupuesto?', a: 'Sí, siempre que te lo avisen antes. Si aceptas el presupuesto y hacen la reparación, normalmente no se cobra aparte.' },
      { q: '¿Qué garantía tiene una reparación?', a: 'La normativa fija una garantía mínima para las reparaciones de vehículos. Pide que figure en la factura y guárdala.' },
    ],
    porVivienda: {
      antigua: 'En las zonas céntricas aparcar es difícil: muchos talleres ofrecen recogida y entrega del coche.',
      mixta: 'En los barrios residenciales abundan los talleres de mecánica general con trato cercano y precios más ajustados que el concesionario.',
      nueva: 'En los desarrollos nuevos, los talleres suelen estar en polígonos cercanos; compara también los que ofrecen coche de sustitución.',
    },
  },
};

module.exports = { CATEGORIAS };
