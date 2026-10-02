/* =========================================================================
   content/guias.js — Guías para el CLIENTE (/guias/<slug>).

   Temas locales de Madrid y dudas reales antes de contratar. Los temas para
   profesionales (Google Maps, reseñas) viven en listo247.es, no aquí, para que
   las dos webs no compitan entre sí. Datos legales: redactados en prudente;
   revisar cuando cambie la normativa y actualizar `updated`.
   ========================================================================= */
'use strict';

const GUIAS = [
  {
    slug: 'que-hacer-ante-una-fuga-de-agua', cat: 'fontaneros', updated: '2026-10-02',
    h1: 'Qué hacer ante una fuga de agua en casa',
    description: 'Pasos para actuar ante una fuga de agua: cortar la llave de paso, avisar al vecino y al seguro, documentar los daños y elegir fontanero sin pagar de más.',
    lead: 'Los primeros diez minutos deciden cuánto daño hace una fuga. Esto es lo que conviene hacer, por orden.',
    sections: [
      { h2: '1. Corta el agua', p: ['Cierra la llave de paso general de la vivienda; suele estar en la cocina, en el baño o junto al contador. Si la fuga viene de un aparato concreto (lavadora, cisterna, termo), cierra también su llave.'], list: ['Si el agua toca enchufes o aparatos, baja el interruptor general de la luz.', 'Recoge el agua y aparta muebles y alfombras.'] },
      { h2: '2. Avisa a quien corresponde', p: ['Si el agua puede llegar al piso de abajo, avisa al vecino cuanto antes. Si la fuga parece venir de una bajante o de una tubería común, avisa también al administrador o al presidente de la comunidad.'] },
      { h2: '3. Haz fotos y llama al seguro', p: ['Antes de reparar, fotografía la zona mojada, las manchas y los objetos dañados. Muchas pólizas de hogar cubren la localización de la fuga y la mano de obra; llama primero a tu aseguradora, que puede enviarte su propio fontanero.'] },
      { h2: '4. Si llamas tú al fontanero', p: ['Elige uno de tu zona: llegará antes y el desplazamiento será más barato. Pide por teléfono el precio de la salida y de la primera hora, y pregunta si hay recargo por noche o festivo.'], list: ['Pide factura con el detalle del trabajo.', 'Guarda las piezas cambiadas si va a intervenir el seguro.'] },
      { h2: 'Fugas que no se ven', p: ['Si el contador sigue girando con todos los grifos cerrados, hay una fuga oculta. Un fontanero con detector o cámara puede localizarla sin romper media pared.'] },
    ],
    faq: [
      { q: '¿Quién paga los daños al vecino?', a: 'Si la fuga sale de tu vivienda, normalmente tu seguro de responsabilidad civil. Si sale de una instalación común, el seguro de la comunidad.' },
      { q: '¿Cuánto cuesta reparar una fuga?', a: 'Una fuga sencilla suele estar entre 60 y 150 €; si hay que localizarla o abrir pared, más. Consulta nuestra página de precios de fontanero.' },
    ],
  },
  {
    slug: 'como-evitar-estafas-cerrajeros', cat: 'cerrajeros', updated: '2026-10-02',
    h1: 'Cómo evitar estafas al llamar a un cerrajero',
    description: 'Señales de alerta y pasos para no pagar de más por una apertura de puerta en Madrid: precio cerrado, factura, seguro y qué hacer si hay abuso.',
    lead: 'Quedarse fuera de casa es el momento perfecto para que te cobren de más. Con cuatro precauciones, evitas casi todos los abusos.',
    sections: [
      { h2: 'Antes de llamar', p: ['Revisa si tu seguro de hogar incluye la apertura por pérdida de llaves: muchas pólizas la cubren. Si no, busca un cerrajero con nombre, dirección y teléfono propios, mejor de tu zona.'] },
      { h2: 'Al teléfono', list: ['Pide el precio cerrado de la apertura con desplazamiento incluido.', 'Pregunta si es de día o de noche y si hay recargo por festivo.', 'Pregunta si la apertura será sin rotura o habrá que cambiar el bombín.', 'Desconfía si no te dan precio hasta llegar.'] },
      { h2: 'Cuando llega', p: ['Antes de que empiece, confirma el precio acordado. Una puerta normal cerrada solo con el resbalón casi siempre se abre sin romper nada; si te proponen romper el bombín de entrada, pregunta por qué.'] },
      { h2: 'Al pagar', p: ['Exige factura con sus datos fiscales y el desglose del trabajo y las piezas. Paga con tarjeta si puedes: deja rastro.'] },
      { h2: 'Si crees que te han cobrado de más', p: ['Pide la hoja de reclamaciones y presenta la queja en los servicios de consumo de tu municipio o de la Comunidad de Madrid. Guarda la factura y cualquier mensaje con el precio pactado.'] },
    ],
    faq: [
      { q: '¿Cuánto debería costar una apertura?', a: 'En horario laborable, entre 80 y 150 € es lo habitual en Madrid. De noche o festivo, más. Mira nuestra página de precios de cerrajero.' },
      { q: '¿Me pueden obligar a cambiar la cerradura?', a: 'No. Si la apertura fue sin rotura, la cerradura sigue sirviendo. El cambio es una decisión tuya.' },
    ],
  },
  {
    slug: 'boletin-electrico-cuando-es-obligatorio', cat: 'electricistas', updated: '2026-10-02',
    h1: 'Boletín eléctrico: qué es y cuándo lo necesitas',
    description: 'Qué es el boletín eléctrico (certificado de instalación), en qué casos lo piden, quién puede emitirlo y cuánto cuesta en Madrid.',
    lead: 'El boletín eléctrico es el nombre popular del certificado de instalación eléctrica. Lo firma una empresa instaladora habilitada y acredita que la instalación cumple el reglamento.',
    sections: [
      { h2: 'Cuándo te lo van a pedir', p: ['Es habitual necesitarlo en estos casos (la comercializadora o la distribuidora te dirán si es tu caso):'], list: ['Para dar de alta la luz en una vivienda nueva o que lleva tiempo sin suministro.', 'Para aumentar la potencia por encima de lo que admite tu instalación.', 'Después de reformar o ampliar la instalación eléctrica.', 'Cuando la instalación es muy antigua y la distribuidora exige revisarla.'] },
      { h2: 'Quién puede emitirlo', p: ['Solo una empresa instaladora habilitada. El técnico revisa la instalación, mide y, si todo está bien, emite el certificado y lo registra. Pide siempre tu copia.'] },
      { h2: 'Qué suelen revisar', list: ['Cuadro eléctrico con interruptor general, diferencial y automáticos adecuados.', 'Toma de tierra.', 'Secciones de cable acordes a cada circuito.', 'Estado general de enchufes y empalmes.'] },
      { h2: 'Cuánto cuesta', p: ['Si la instalación ya cumple, el boletín suele estar entre 90 y 250 € en Madrid. Si hay que adaptar algo (diferencial, toma de tierra, cuadro), el precio sube según lo que falte.'] },
    ],
    faq: [
      { q: '¿Caduca el boletín?', a: 'El certificado acredita el estado de la instalación cuando se hizo. Si la instalación cambia o es muy antigua, pueden pedirte uno nuevo.' },
      { q: '¿Lo necesito para alquilar mi piso?', a: 'No siempre, pero si el inquilino tiene que dar de alta la luz y la instalación es antigua, puede hacer falta. Mejor tenerlo al día.' },
    ],
  },
  {
    slug: 'como-elegir-empresa-de-reformas', cat: 'reformas', updated: '2026-10-02',
    h1: 'Cómo elegir empresa de reformas en Madrid',
    description: 'Cómo pedir y comparar presupuestos de reforma, qué debe incluir el contrato, calendario de pagos y señales de alerta antes de elegir empresa.',
    lead: 'Elegir mal la empresa es el error más caro de una reforma. Estos pasos te ayudan a comparar con criterio y no solo por precio.',
    sections: [
      { h2: 'Define antes qué quieres', p: ['Haz una lista de lo que quieres cambiar, con fotos de ideas y un presupuesto máximo. Cuanto más concreto seas, más comparables serán los presupuestos.'] },
      { h2: 'Pide al menos tres presupuestos', p: ['Que te los den por escrito y por partidas: demolición, albañilería, fontanería, electricidad, alicatado, carpintería, pintura y gestión de residuos. Un precio cerrado sin desglose no se puede comparar.'] },
      { h2: 'Qué debe figurar en el contrato', list: ['Descripción de los trabajos, calidades y marcas.', 'Plazo de inicio y de fin, y qué pasa si se retrasan.', 'Calendario de pagos ligado al avance de la obra.', 'Quién gestiona los permisos y paga las tasas.', 'Garantía de los trabajos.'] },
      { h2: 'Comprueba a la empresa', p: ['Pide fotos de obras parecidas, lee sus reseñas y, si puedes, habla con algún cliente anterior. Pregunta si tienen seguro de responsabilidad civil.'] },
      { h2: 'Señales de alerta', list: ['Piden más del 30–40 % por adelantado.', 'No quieren poner nada por escrito.', 'Su presupuesto es mucho más barato que el resto sin explicar por qué.', 'No hablan de licencia ni de gestión de escombros.'] },
    ],
    faq: [
      { q: '¿Cuánto cuesta reformar un piso?', a: 'En Madrid, una reforma integral de calidad media suele moverse entre 600 y 900 €/m². Tienes el detalle en nuestra página de precios.' },
      { q: '¿Quién pide la licencia?', a: 'Puede hacerlo la empresa o tú. Déjalo claro en el contrato.' },
    ],
  },
  {
    slug: 'licencia-de-obra-madrid', cat: 'reformas', updated: '2026-10-02',
    h1: 'Licencia de obra en Madrid: ¿qué necesitas para reformar?',
    description: 'Declaración responsable o licencia: qué trámite suele hacer falta para reformar una vivienda en Madrid, qué impuestos se pagan y qué pasa en otros municipios.',
    lead: 'No todas las reformas necesitan lo mismo. En Madrid capital, la mayoría de obras interiores se tramitan con una declaración responsable; las grandes, con licencia.',
    sections: [
      { h2: 'Declaración responsable', p: ['Es un trámite en el que declaras que la obra cumple la normativa. En Madrid capital se usa para la mayoría de reformas interiores de vivienda que no afectan a la estructura ni a elementos comunes. Con ella presentada, normalmente puedes empezar la obra sin esperar una resolución.'] },
      { h2: 'Licencia de obra', p: ['Hace falta en obras de más entidad: las que tocan estructura, fachada, cubierta o elementos comunes, cambios de uso o ampliaciones. Suele requerir proyecto técnico firmado por un arquitecto o arquitecto técnico.'] },
      { h2: 'Impuestos y tasas', p: ['Se paga el impuesto sobre construcciones, instalaciones y obras (ICIO) y la tasa del trámite urbanístico, calculados sobre el presupuesto de ejecución. Inclúyelos en tu presupuesto total.'] },
      { h2: 'Fuera de Madrid capital', p: ['Cada ayuntamiento de la Comunidad tiene su propia ordenanza: lo que en Madrid es una declaración responsable, en otro municipio puede ser una licencia. Consulta la sede electrónica de tu ayuntamiento.'] },
      { h2: 'Antes de empezar', list: ['Comprueba en la sede electrónica de tu ayuntamiento qué trámite corresponde a tu obra.', 'Si vives en un bloque, informa a la comunidad (horarios, uso del ascensor, contenedor).', 'Pide a la empresa que gestione el trámite y que lo incluya en el presupuesto.', 'El contenedor de escombros en la calle necesita su propia autorización.'] },
    ],
    faq: [
      { q: '¿Pintar o cambiar el suelo necesita permiso?', a: 'Las obras menores de mantenimiento suelen tener un trámite muy simple o ninguno, pero depende del municipio. Consúltalo antes en tu ayuntamiento.' },
      { q: '¿Qué pasa si reformo sin permiso?', a: 'El ayuntamiento puede paralizar la obra y sancionarte, y te puede dar problemas al vender la vivienda.' },
    ],
  },
  {
    slug: 'chinches-y-cucarachas-en-casa', cat: 'control-de-plagas', updated: '2026-10-02',
    h1: 'Chinches y cucarachas en casa: cómo actuar',
    description: 'Cómo detectar chinches y cucarachas, qué hacer antes de llamar a una empresa de control de plagas y cómo evitar que vuelvan.',
    lead: 'Son las dos plagas más habituales en las viviendas de Madrid. Cuanto antes actúes, más corto y barato es el tratamiento.',
    sections: [
      { h2: 'Cómo saber si tienes chinches', list: ['Picaduras en línea o en grupo al despertar.', 'Manchas pequeñas oscuras en el colchón y las costuras.', 'Insectos marrones y planos del tamaño de una lenteja.'] },
      { h2: 'Cómo saber si tienes cucarachas', list: ['Verlas de noche en cocina o baño.', 'Excrementos como granos de pimienta en cajones y rincones.', 'Olor desagradable en armarios cerrados.'] },
      { h2: 'Qué hacer antes del tratamiento', p: ['No uses insecticidas de supermercado sin control: con las chinches, pueden dispersarlas a otras habitaciones. Con las cucarachas, ordena, limpia restos de comida y sella grietas.'], list: ['Lava la ropa de cama a más de 60 °C (chinches).', 'Avisa al administrador si vives en un bloque.', 'Sigue las instrucciones de preparación que te dé la empresa.'] },
      { h2: 'Elegir empresa', p: ['Pide que esté inscrita en el registro oficial de servicios biocidas (ROESB), que te haga un diagnóstico antes del precio y que incluya revisión y garantía.'] },
    ],
    faq: [
      { q: '¿Cuánto cuesta el tratamiento?', a: 'Cucarachas en un piso: 80–180 €. Chinches: 150–400 €, normalmente en dos visitas. Detalles en nuestra página de precios.' },
      { q: '¿Las chinches son señal de suciedad?', a: 'No. Viajan en maletas, muebles y ropa; pueden aparecer en cualquier casa.' },
    ],
  },
  {
    slug: 'mudanza-en-madrid', cat: 'mudanzas', updated: '2026-10-02',
    h1: 'Mudanza en Madrid: trámites y lista de tareas',
    description: 'Lista de tareas para una mudanza en Madrid: reserva de espacio para el camión, empadronamiento, cambio de suministros y cómo elegir empresa.',
    lead: 'Una mudanza son decenas de pequeñas tareas. Esta lista te ayuda a no olvidar las importantes.',
    sections: [
      { h2: 'Un mes antes', list: ['Pide dos o tres presupuestos con visita o videollamada.', 'Reserva la fecha (en verano y a final de mes, con más antelación).', 'Decide qué no te llevas: vende, dona o tira.'] },
      { h2: 'Dos semanas antes', list: ['Comprueba si hace falta reservar espacio en la vía pública para el camión; muchas empresas lo gestionan por ti.', 'Avisa a las comunidades de ambos edificios del día y la hora.', 'Empieza a embalar lo que no usas a diario.'] },
      { h2: 'Suministros', p: ['Da de baja o cambia de titular la luz, el agua, el gas e internet en la vivienda que dejas, y da de alta los de la nueva con lecturas del día.'] },
      { h2: 'Después de la mudanza', list: ['Empadrónate en tu nuevo domicilio: es obligatorio y lo necesitarás para muchos trámites.', 'Cambia la dirección en el banco, Hacienda, el seguro y tu centro de salud.', 'Revisa el inventario y anota cualquier daño para el seguro de la mudanza.'] },
    ],
    faq: [
      { q: '¿Cuánto cuesta una mudanza en Madrid?', a: 'Un piso de dos dormitorios dentro de Madrid suele estar entre 450 y 800 €. Consulta nuestra página de precios de mudanzas.' },
      { q: '¿Hay que empadronarse?', a: 'Sí, cuando cambias de domicilio habitual. Se hace en el ayuntamiento, presencialmente o por sede electrónica.' },
    ],
  },
  {
    slug: 'derechos-en-el-taller', cat: 'talleres', updated: '2026-10-02',
    h1: 'Tus derechos en el taller: presupuesto, factura y garantía',
    description: 'Qué derechos tienes al llevar el coche al taller: presupuesto por escrito, factura detallada, garantía de la reparación y hoja de reclamaciones.',
    lead: 'La normativa de talleres te protege más de lo que parece. Conocer cuatro derechos básicos evita la mayoría de disgustos.',
    sections: [
      { h2: 'Presupuesto por escrito', p: ['Tienes derecho a un presupuesto escrito antes de la reparación, con las piezas, las horas de mano de obra y el plazo. Solo puedes renunciar a él por escrito. Si lo aceptas, el taller no puede cobrarte más sin tu autorización.'] },
      { h2: 'Factura detallada', p: ['La factura debe detallar las piezas cambiadas, su precio y las horas de trabajo. Puedes pedir que te devuelvan las piezas sustituidas.'] },
      { h2: 'Garantía de la reparación', p: ['Las reparaciones tienen una garantía mínima fijada por la normativa, que cubre la mano de obra y las piezas. Guarda la factura: es tu prueba.'] },
      { h2: 'Hoja de reclamaciones', p: ['Todos los talleres deben tener hojas de reclamaciones a disposición de los clientes. Si hay un problema que no se resuelve, preséntala y acude a los servicios de consumo.'] },
      { h2: 'Antes de dejar el coche', list: ['Anota los kilómetros y el estado del vehículo.', 'Explica por escrito la avería o el servicio que pides.', 'Pide que te llamen antes de hacer cualquier trabajo no presupuestado.'] },
    ],
    faq: [
      { q: '¿Me pueden cobrar el presupuesto?', a: 'Sí, si te lo avisan antes. Si aceptas y te hacen la reparación, normalmente no se cobra aparte.' },
      { q: '¿Pierdo la garantía del fabricante en un taller independiente?', a: 'No, si sigue el plan de mantenimiento y usa recambios de calidad equivalente.' },
    ],
  },
];

module.exports = { GUIAS };
