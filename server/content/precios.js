/* =========================================================================
   content/precios.js — Páginas /precios/<slug>: «¿cuánto cuesta…?» en Madrid.

   Son rangos ORIENTATIVOS (IVA incluido) de presupuestos habituales en la
   Comunidad de Madrid: cada profesional fija sus precios. Revisarlos cada año
   y actualizar `updated`. Cada página enlaza a su categoría y a sus guías.
   ========================================================================= */
'use strict';

const UPDATED = '2026-10-02';

const PRECIOS = [
  {
    slug: 'precio-fontanero-madrid', cat: 'fontaneros',
    h1: '¿Cuánto cobra un fontanero en Madrid?',
    description: 'Precios orientativos de fontanero en Madrid: salida y primera hora, urgencias, fugas, grifos, cisternas y calentadores. Qué encarece la factura y cómo evitar sorpresas.',
    lead: 'La mayoría de avisos de fontanería se resuelven en una o dos horas. Lo que más cambia el precio es la hora a la que llamas y si hay que cambiar piezas.',
    tabla: [
      { c: 'Salida + primera hora (laborable)', p: '40 – 80 €' },
      { c: 'Hora adicional', p: '25 – 45 €' },
      { c: 'Urgencia nocturna o festivo', p: '+50 % – 100 %', n: 'sobre la tarifa normal' },
      { c: 'Reparar una fuga sencilla', p: '60 – 150 €' },
      { c: 'Cambiar un grifo (mano de obra)', p: '50 – 100 €', n: 'grifo aparte' },
      { c: 'Cambiar el mecanismo de la cisterna', p: '60 – 120 €' },
      { c: 'Cambiar un calentador o termo', p: '150 – 350 €', n: 'aparato aparte' },
    ],
    factores: [
      'La franja horaria: de noche, en fin de semana o en festivo casi siempre hay recargo.',
      'Si la avería está a la vista o hay que abrir pared o suelo.',
      'Las piezas: no es lo mismo un latiguillo que un grifo termostático.',
      'La distancia: un fontanero de tu zona suele cobrar menos desplazamiento.',
    ],
    ahorro: [
      'Corta la llave de paso y llama en horario laborable si la fuga lo permite.',
      'Agrupa pequeños arreglos en una sola visita.',
      'Si tienes seguro de hogar, llama primero: muchas pólizas cubren la mano de obra.',
    ],
    alertas: [
      'No da precio de la salida por teléfono.',
      'Pide pagar todo por adelantado o solo en efectivo, sin factura.',
      'Insiste en cambiar toda la instalación por una fuga puntual sin enseñarte el problema.',
    ],
    faq: [
      { q: '¿La salida se cobra aunque no se repare nada?', a: 'Normalmente sí: el desplazamiento y el diagnóstico tienen coste. Pregunta cuánto antes de que venga.' },
      { q: '¿Cobran por horas o por trabajo?', a: 'Las reparaciones pequeñas suelen cobrarse por horas; los trabajos grandes (calentador, baño) por presupuesto cerrado.' },
    ],
    guias: ['que-hacer-ante-una-fuga-de-agua'],
  },
  {
    slug: 'precio-desatasco-madrid', cat: 'fontaneros',
    h1: '¿Cuánto cuesta un desatasco en Madrid?',
    description: 'Precios orientativos de desatascos en Madrid: fregadero, inodoro, bajante, arqueta, máquina, camión cuba e inspección con cámara.',
    lead: 'El precio de un desatasco depende de dónde está el tapón: no es lo mismo un fregadero que una bajante comunitaria o una arqueta en la calle.',
    tabla: [
      { c: 'Fregadero, lavabo o ducha', p: '60 – 120 €' },
      { c: 'Inodoro', p: '70 – 140 €' },
      { c: 'Bajante o tubería general con máquina', p: '100 – 250 €' },
      { c: 'Camión cuba (arquetas, fosas)', p: '200 – 450 €' },
      { c: 'Inspección con cámara', p: '100 – 250 €', n: 'a veces incluida si se hace el trabajo' },
    ],
    factores: [
      'Ubicación del atasco: en tu vivienda o en la red común del edificio.',
      'Herramienta necesaria: muelle manual, máquina eléctrica o camión de presión.',
      'Urgencia y horario.',
      'Si después hay que reparar la tubería.',
    ],
    ahorro: [
      'Para atascos leves, prueba agua caliente y un desatascador de ventosa antes de llamar.',
      'Si el atasco afecta a varios vecinos, avisa al administrador: la bajante común la paga la comunidad.',
      'Pide precio cerrado por desatasco, no por horas indefinidas.',
    ],
    alertas: [
      'Propone una inspección con cámara cara sin haber intentado antes el desatasco.',
      'No informa del precio del camión hasta que ya está en la puerta.',
    ],
    faq: [
      { q: '¿Quién paga el desatasco de la bajante?', a: 'Si el tapón está en la bajante o la red común, la comunidad. Si está en tu tramo de tubería, tú o tu seguro.' },
      { q: '¿Sirven los productos desatascadores?', a: 'Para grasa leve pueden ayudar, pero con atascos serios pueden dañar tuberías antiguas. Mejor no abusar de ellos.' },
    ],
    guias: ['que-hacer-ante-una-fuga-de-agua'],
  },
  {
    slug: 'precio-reforma-bano-madrid', cat: 'reformas',
    h1: '¿Cuánto cuesta reformar un baño en Madrid?',
    description: 'Precio orientativo de una reforma de baño en Madrid según calidades: básica, media y alta. Cambio de bañera por plato de ducha, alicatado, sanitarios y plazos.',
    lead: 'Para un baño típico de 4 a 5 m², la mayor parte del presupuesto se va en alicatado, fontanería y sanitarios. Las calidades marcan la diferencia.',
    tabla: [
      { c: 'Reforma completa, calidad básica', p: '3.500 – 5.500 €' },
      { c: 'Reforma completa, calidad media', p: '5.000 – 9.000 €' },
      { c: 'Reforma completa, calidad alta', p: '9.000 – 15.000 €' },
      { c: 'Cambiar bañera por plato de ducha', p: '900 – 2.000 €' },
      { c: 'Cambiar solo sanitarios y grifería', p: '600 – 1.800 €' },
    ],
    factores: [
      'Metros y estado de las instalaciones (en pisos antiguos suele haber que renovar tuberías).',
      'Alicatado completo o solo zonas húmedas; tamaño y tipo de pieza.',
      'Mampara, mueble de lavabo y grifería termostática.',
      'Si se cambia la distribución o se mueven tomas de agua.',
    ],
    ahorro: [
      'Mantener la distribución y las tomas de agua abarata mucho la obra.',
      'Valora el microcemento o el porcelánico sobre el azulejo existente si está en buen estado.',
      'Compra tú sanitarios y grifería solo si la empresa acepta instalarlos sin recargo.',
    ],
    alertas: [
      'Presupuesto sin desglose («baño completo: X €»).',
      'No menciona la retirada de escombros ni la gestión de residuos.',
      'Pide más del 30–40 % por adelantado.',
    ],
    faq: [
      { q: '¿Cuánto tarda la reforma de un baño?', a: 'Entre dos y tres semanas de obra, más el plazo de entrega de materiales.' },
      { q: '¿Necesito permiso?', a: 'Depende del municipio y de la obra. En Madrid capital, una reforma interior sin tocar estructura suele tramitarse con declaración responsable.' },
    ],
    guias: ['como-elegir-empresa-de-reformas', 'licencia-de-obra-madrid'],
  },
  {
    slug: 'precio-reforma-cocina-madrid', cat: 'reformas',
    h1: '¿Cuánto cuesta reformar una cocina en Madrid?',
    description: 'Precio orientativo de una reforma de cocina en Madrid: muebles, encimera, electrodomésticos, instalaciones y obra. Rangos por calidades y qué encarece el presupuesto.',
    lead: 'En una cocina, los muebles y la encimera suelen ser la mitad del presupuesto. El resto lo deciden la obra y los electrodomésticos.',
    tabla: [
      { c: 'Cocina de 8–10 m², calidad media (con muebles)', p: '7.000 – 15.000 €' },
      { c: 'Solo muebles y encimera', p: '3.000 – 7.000 €' },
      { c: 'Encimera de cuarzo o porcelánico (por metro)', p: '250 – 600 €/m lineal' },
      { c: 'Renovar instalación eléctrica y de agua', p: '1.200 – 3.000 €' },
      { c: 'Alicatado y suelo', p: '1.500 – 4.000 €' },
    ],
    factores: [
      'Metros lineales de muebles y tipo de acabado.',
      'Material de la encimera.',
      'Electrodomésticos integrados o de libre instalación.',
      'Cambiar la distribución (mover fregadero o tomas de gas).',
    ],
    ahorro: [
      'Mantener la posición del fregadero y la placa evita obra de fontanería.',
      'Reaprovechar electrodomésticos recientes.',
      'Pedir varias opciones de encimera con el mismo diseño de muebles.',
    ],
    alertas: [
      'El presupuesto de muebles no incluye montaje ni remates.',
      'No especifica la marca y la gama de herrajes y electrodomésticos.',
    ],
    faq: [
      { q: '¿Cuánto tarda una reforma de cocina?', a: 'Unas tres o cuatro semanas, contando el plazo de fabricación de muebles y encimera.' },
      { q: '¿Se puede reformar sin quitar el suelo?', a: 'Sí, si el suelo está bien y los muebles nuevos ocupan lo mismo. Si cambias la distribución, suele haber que rematarlo.' },
    ],
    guias: ['como-elegir-empresa-de-reformas'],
  },
  {
    slug: 'precio-reforma-integral-piso-madrid', cat: 'reformas',
    h1: '¿Cuánto cuesta una reforma integral de un piso en Madrid?',
    description: 'Precio orientativo por metro cuadrado de una reforma integral en Madrid: calidad básica, media y alta, qué incluye, plazos y trámites.',
    lead: 'La reforma integral se presupuesta por metro cuadrado. En Madrid, la horquilla habitual va de unos 500 a más de 1.000 €/m² según calidades y el estado del piso.',
    tabla: [
      { c: 'Calidad básica', p: '450 – 650 €/m²' },
      { c: 'Calidad media', p: '600 – 900 €/m²' },
      { c: 'Calidad alta', p: '900 – 1.300 €/m²' },
      { c: 'Ejemplo: piso de 80 m², calidad media', p: '48.000 – 72.000 €' },
      { c: 'Proyecto técnico y dirección de obra (si hace falta)', p: '2.000 – 6.000 €' },
    ],
    factores: [
      'Estado de las instalaciones: en pisos antiguos casi siempre hay que renovarlas.',
      'Cambios de distribución (tirar o levantar tabiques).',
      'Ventanas, suelos, carpintería interior y climatización.',
      'Trámites e impuestos municipales.',
    ],
    ahorro: [
      'Define bien el proyecto antes de empezar: los cambios a mitad de obra son lo más caro.',
      'Pide presupuestos por partidas para comparar empresa con empresa.',
      'Valora qué conservar (suelos, carpintería) si está en buen estado.',
    ],
    alertas: [
      'Precio por metro cuadrado sin explicar qué incluye.',
      'Sin calendario de obra ni de pagos.',
      'No habla de licencia o declaración responsable.',
    ],
    faq: [
      { q: '¿Cuánto tarda una reforma integral?', a: 'Para unos 80 m², entre dos y tres meses de obra, más el tiempo de trámites.' },
      { q: '¿Qué impuestos se pagan?', a: 'En Madrid capital, el impuesto de construcciones (ICIO) y la tasa del trámite urbanístico, calculados sobre el presupuesto de ejecución.' },
    ],
    guias: ['licencia-de-obra-madrid', 'como-elegir-empresa-de-reformas'],
  },
  {
    slug: 'precio-electricista-madrid', cat: 'electricistas',
    h1: '¿Cuánto cobra un electricista en Madrid?',
    description: 'Precios orientativos de electricista en Madrid: salida y hora, cambiar enchufes, cuadro eléctrico, instalación completa de un piso y urgencias.',
    lead: 'Las averías pequeñas se cobran por horas; los trabajos de instalación, por presupuesto. Si el trabajo requiere boletín, necesitas una empresa habilitada.',
    tabla: [
      { c: 'Salida + primera hora (laborable)', p: '40 – 70 €' },
      { c: 'Hora adicional', p: '25 – 40 €' },
      { c: 'Cambiar un enchufe o interruptor', p: '30 – 60 €' },
      { c: 'Cuadro eléctrico nuevo', p: '300 – 700 €' },
      { c: 'Instalación completa de un piso de 80 m²', p: '3.000 – 6.000 €' },
      { c: 'Urgencia nocturna o festivo', p: '+50 % – 100 %' },
    ],
    factores: [
      'Si el cableado va por tubo o hay que abrir rozas.',
      'Número de puntos de luz y enchufes.',
      'Necesidad de boletín y de subir potencia.',
      'Urgencia y horario.',
    ],
    ahorro: [
      'Agrupa varios arreglos en la misma visita.',
      'Si vas a reformar, haz la electricidad antes de pintar y alicatar.',
      'Pide que separe materiales y mano de obra en el presupuesto.',
    ],
    alertas: [
      'No es empresa habilitada y aun así ofrece «sacar el boletín».',
      'Propone subir potencia sin revisar la instalación.',
    ],
    faq: [
      { q: '¿Cuánto cuesta el boletín eléctrico?', a: 'Si la instalación ya cumple, suele estar entre 90 y 250 €. Si hay que adaptarla, depende de lo que falte. Lo explicamos en la guía del boletín.' },
      { q: '¿Por qué saltan los plomos al encender el horno?', a: 'Puede ser exceso de consumo para la potencia contratada o una línea insuficiente. Un electricista lo comprueba en una visita.' },
    ],
    guias: ['boletin-electrico-cuando-es-obligatorio'],
  },
  {
    slug: 'precio-boletin-electrico-madrid', cat: 'electricistas',
    h1: '¿Cuánto cuesta el boletín eléctrico en Madrid?',
    description: 'Precio orientativo del boletín eléctrico (certificado de instalación) en Madrid: con la instalación en regla y cuando hay que adaptarla. Qué incluye y quién puede emitirlo.',
    lead: 'El boletín (certificado de instalación eléctrica) lo emite una empresa instaladora habilitada después de revisar tu instalación. El precio depende sobre todo de si hay que arreglar algo.',
    tabla: [
      { c: 'Boletín con la instalación en regla', p: '90 – 250 €' },
      { c: 'Pequeñas adaptaciones (diferencial, toma de tierra…)', p: '150 – 600 €' },
      { c: 'Renovar el cuadro eléctrico', p: '300 – 700 €' },
      { c: 'Instalación nueva completa (piso medio)', p: '3.000 – 6.000 €' },
    ],
    factores: [
      'Antigüedad y estado de la instalación.',
      'Potencia que necesitas contratar.',
      'Si falta toma de tierra o protecciones.',
    ],
    ahorro: [
      'Pide que te digan qué falta antes de aceptar adaptaciones.',
      'Si vas a reformar, haz la instalación nueva y el boletín a la vez.',
    ],
    alertas: [
      'Ofrecen el boletín sin visitar la vivienda.',
      'No te entregan copia del certificado registrado.',
    ],
    faq: [
      { q: '¿Quién puede hacer el boletín?', a: 'Solo una empresa instaladora habilitada. Pide su número de habilitación.' },
      { q: '¿Cuánto tarda?', a: 'Si la instalación está bien, en uno o dos días está emitido.' },
    ],
    guias: ['boletin-electrico-cuando-es-obligatorio'],
  },
  {
    slug: 'precio-cerrajero-madrid', cat: 'cerrajeros',
    h1: '¿Cuánto cuesta un cerrajero en Madrid?',
    description: 'Precios orientativos de cerrajero en Madrid: abrir una puerta de día y de noche, cambiar el bombín, bombín de seguridad y blindaje. Cómo evitar abusos.',
    lead: 'Es el servicio con más quejas por precios abusivos. La regla es sencilla: precio cerrado por teléfono antes de que el cerrajero salga.',
    tabla: [
      { c: 'Apertura sin rotura (laborable, de día)', p: '80 – 150 €' },
      { c: 'Apertura de noche o festivo', p: '120 – 250 €' },
      { c: 'Cambio de bombín estándar (con pieza)', p: '80 – 180 €' },
      { c: 'Bombín de seguridad antibumping (con pieza)', p: '120 – 300 €' },
      { c: 'Blindaje de puerta de madera', p: '500 – 1.200 €' },
    ],
    factores: [
      'Hora y día de la llamada.',
      'Tipo de cerradura y de puerta (blindada, acorazada).',
      'Si se puede abrir sin romper el bombín.',
    ],
    ahorro: [
      'Comprueba si tu seguro de hogar cubre la apertura.',
      'Ten una copia de llaves con alguien de confianza.',
      'Para mejorar la seguridad, cambia el bombín antes de pensar en una puerta nueva.',
    ],
    alertas: [
      'No da precio hasta llegar.',
      'Rompe el bombín sin intentar una apertura limpia y te vende uno caro.',
      'No entrega factura.',
    ],
    faq: [
      { q: '¿Pueden cobrarme más de lo acordado?', a: 'No, si el precio se cerró antes. Pide factura y, si hay abuso, usa la hoja de reclamaciones o acude a consumo.' },
      { q: '¿Qué es un bombín antibumping?', a: 'Un cilindro preparado contra una técnica de apertura sin marcas. Es la mejora de seguridad más rentable.' },
    ],
    guias: ['como-evitar-estafas-cerrajeros'],
  },
  {
    slug: 'precio-instalar-aire-acondicionado-madrid', cat: 'climatizacion',
    h1: '¿Cuánto cuesta instalar aire acondicionado en Madrid?',
    description: 'Precio orientativo de instalar aire acondicionado en Madrid: split, multisplit y conductos, con equipo y sin equipo, y mantenimiento anual.',
    lead: 'El precio total depende del equipo y de la instalación. Un split sencillo es lo más barato; los conductos, lo más caro pero también lo más cómodo.',
    tabla: [
      { c: 'Instalación de split (solo mano de obra)', p: '300 – 600 €' },
      { c: 'Split con equipo de gama media, instalado', p: '800 – 1.800 €' },
      { c: 'Multisplit (2–3 unidades interiores)', p: '2.000 – 4.500 €' },
      { c: 'Conductos (piso de 80–100 m²)', p: '3.500 – 7.000 €' },
      { c: 'Mantenimiento anual', p: '60 – 120 €' },
    ],
    factores: [
      'Potencia y marca del equipo.',
      'Distancia entre unidad interior y exterior y metros de línea.',
      'Dónde va la unidad exterior (fachada, patio, cubierta) y si hace falta grúa o andamio.',
      'Época del año: en verano hay más demanda.',
    ],
    ahorro: [
      'Pide presupuesto en primavera, antes de la temporada alta.',
      'Si tienes preinstalación, la instalación es más rápida y barata.',
      'Elige la potencia justa: un equipo sobredimensionado gasta más.',
    ],
    alertas: [
      'El técnico no tiene certificado para manipular gases fluorados.',
      'El presupuesto no dice cuántos metros de línea incluye.',
    ],
    faq: [
      { q: '¿Cuánto tarda la instalación de un split?', a: 'Entre medio día y un día, si no hay complicaciones de acceso.' },
      { q: '¿Necesito permiso de la comunidad?', a: 'Si la unidad exterior va en fachada o elementos comunes, normalmente sí.' },
    ],
    guias: [],
  },
  {
    slug: 'precio-mudanza-madrid', cat: 'mudanzas',
    h1: '¿Cuánto cuesta una mudanza en Madrid?',
    description: 'Precios orientativos de mudanzas en Madrid: dentro de la ciudad por tamaño de vivienda, mudanzas nacionales, guardamuebles y servicios extra.',
    lead: 'Una mudanza se presupuesta por volumen, distancia y dificultad (plantas, ascensor, acceso del camión). Con una visita o una videollamada, el precio debería ser cerrado.',
    tabla: [
      { c: 'Estudio o piso de 1 dormitorio (dentro de Madrid)', p: '300 – 550 €' },
      { c: 'Piso de 2 dormitorios', p: '450 – 800 €' },
      { c: 'Piso de 3–4 dormitorios', p: '700 – 1.400 €' },
      { c: 'Mudanza nacional (ej. Madrid–Valencia)', p: '1.000 – 2.500 €' },
      { c: 'Guardamuebles', p: '60 – 150 €/mes' },
    ],
    factores: [
      'Volumen y número de muebles grandes.',
      'Plantas sin ascensor o necesidad de elevador exterior.',
      'Embalaje, desmontaje y montaje incluidos o no.',
      'Fecha: en verano y a final de mes hay más demanda.',
    ],
    ahorro: [
      'Haz tú el embalaje de objetos pequeños.',
      'Múdate entre semana y a mitad de mes si puedes.',
      'Deshazte antes de lo que no vayas a llevarte.',
    ],
    alertas: [
      'Presupuesto por teléfono sin ver el volumen.',
      'No explica qué cubre el seguro.',
      'Cobra extras «por sorpresa» el día de la mudanza.',
    ],
    faq: [
      { q: '¿Está incluido el seguro?', a: 'Las empresas serias incluyen un seguro básico. Pregunta el límite de cobertura si tienes objetos de valor.' },
      { q: '¿Tengo que reservar el aparcamiento?', a: 'En muchas calles de Madrid conviene reservar espacio en la vía pública para el camión. Muchas empresas lo gestionan.' },
    ],
    guias: ['mudanza-en-madrid'],
  },
  {
    slug: 'precio-control-de-plagas-madrid', cat: 'control-de-plagas',
    h1: '¿Cuánto cuesta eliminar una plaga en Madrid?',
    description: 'Precios orientativos de control de plagas en Madrid: cucarachas, chinches, roedores y tratamientos para comunidades de vecinos.',
    lead: 'El precio depende de la plaga, del tamaño de la vivienda y del número de visitas. Un diagnóstico previo evita pagar por un tratamiento que no toca.',
    tabla: [
      { c: 'Cucarachas en piso (gel, con revisión)', p: '80 – 180 €' },
      { c: 'Chinches (normalmente 2 tratamientos)', p: '150 – 400 €' },
      { c: 'Desratización de vivienda', p: '100 – 250 €' },
      { c: 'Tratamiento de zonas comunes de una comunidad', p: '200 – 600 €' },
      { c: 'Contrato anual para negocios', p: 'desde 20 – 60 €/mes' },
    ],
    factores: [
      'Tipo de plaga y nivel de infestación.',
      'Metros de la vivienda o del local.',
      'Número de visitas y garantía.',
      'Si hay que tratar también zonas comunes.',
    ],
    ahorro: [
      'Coordínate con la comunidad: tratar todo el edificio a la vez evita repetir.',
      'Sigue las instrucciones de preparación de la empresa para no repetir visitas.',
    ],
    alertas: [
      'La empresa no está inscrita en el registro oficial de servicios biocidas.',
      'No ofrece garantía ni revisión.',
    ],
    faq: [
      { q: '¿Cuántas visitas hacen falta?', a: 'Cucarachas: una aplicación y una revisión. Chinches: normalmente dos tratamientos separados unas semanas.' },
      { q: '¿Tengo que salir de casa?', a: 'Depende del producto. La empresa te indicará el plazo de seguridad.' },
    ],
    guias: ['chinches-y-cucarachas-en-casa'],
  },
  {
    slug: 'precio-cambio-aceite-taller-madrid', cat: 'talleres',
    h1: '¿Cuánto cuesta el mantenimiento del coche en un taller de Madrid?',
    description: 'Precios orientativos de taller en Madrid: cambio de aceite y filtros, revisión, pastillas de freno, neumáticos y diagnosis.',
    lead: 'El mantenimiento periódico es lo que más se repite en el taller. Comparar dos o tres presupuestos por escrito puede suponer una diferencia notable.',
    tabla: [
      { c: 'Cambio de aceite y filtro', p: '70 – 150 €' },
      { c: 'Revisión completa (aceite, filtros, niveles)', p: '150 – 350 €' },
      { c: 'Pastillas de freno delanteras', p: '90 – 200 €' },
      { c: 'Montaje y equilibrado de 4 neumáticos (sin neumáticos)', p: '40 – 80 €' },
      { c: 'Diagnosis electrónica', p: '30 – 70 €' },
    ],
    factores: [
      'Marca y modelo del coche.',
      'Recambio original o equivalente.',
      'Tipo de aceite que exige el fabricante.',
    ],
    ahorro: [
      'Pide presupuesto por escrito y compara.',
      'Sigue el plan de mantenimiento: evita averías más caras.',
      'Pregunta si tienen ofertas en neumáticos y revisiones pre-ITV.',
    ],
    alertas: [
      'No te dan presupuesto por escrito antes de reparar.',
      'La factura no detalla piezas y horas.',
    ],
    faq: [
      { q: '¿Pierdo la garantía si no voy al concesionario?', a: 'No, si el taller sigue el plan del fabricante y usa recambios equivalentes. Guarda las facturas.' },
      { q: '¿Cada cuánto se cambia el aceite?', a: 'Lo indica el fabricante; suele ser cada 15.000 a 30.000 km o una vez al año.' },
    ],
    guias: ['derechos-en-el-taller'],
  },
];

module.exports = { PRECIOS, UPDATED };
