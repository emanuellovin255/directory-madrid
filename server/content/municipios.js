/* =========================================================================
   content/municipios.js — Notas locales de los municipios con más empresas
   en el directorio (fuera de Madrid capital). Mismo formato que distritos.js:
   se combinan con la nota del servicio por tipo de vivienda (categorias.js →
   porVivienda) y con los datos reales del listado, para que cada página
   servicio×municipio tenga texto propio y no solo una frase de plantilla.

   Solo datos generales y comprobables (barrios, época de la vivienda, clima):
   nada de cifras inventadas. Para añadir un municipio: su slug y una nota.
   ========================================================================= */
'use strict';

const MUNICIPIOS = {
  'collado-villalba': { vivienda: 'mixta', nota: 'Capital de la sierra noroeste: bloques de los años 70 y 80 en torno al centro y la estación, y muchas urbanizaciones de chalets en las afueras. En invierno hiela a menudo, así que la calefacción, el aislamiento y las tuberías exteriores dan más trabajo que en la capital.' },
  'las-rozas-de-madrid': { vivienda: 'nueva', nota: 'Municipio de urbanizaciones y chalets, como El Montecillo, Molino de la Hoz o Monterrozas, junto a Las Matas y el centro urbano. Abunda la vivienda de los últimos 30 años con jardín y piscina, que pide mantenimiento todo el año.' },
  fuenlabrada: { vivienda: 'mixta', nota: 'Creció muy deprisa entre los años 70 y 90, y la mayoría de los pisos son bloques de esa época; en Loranca y El Vivero hay promociones más recientes. Sus polígonos industriales concentran muchos talleres y empresas de servicios.' },
  mostoles: { vivienda: 'mixta', nota: 'Uno de los municipios más poblados de la Comunidad: bloques de los años 70 en el centro y en barrios como Villafontana, la urbanización de chalets de Parque Coimbra y el desarrollo reciente de Móstoles Sur (PAU 4).' },
  'alcala-de-henares': { vivienda: 'mixta', nota: 'Su casco histórico es Patrimonio de la Humanidad y las obras que afectan a fachadas o a edificios protegidos necesitan permisos específicos. Fuera del centro predominan los bloques de los años 60 y 70, y los barrios nuevos están en Espartales y La Garena.' },
  'arganda-del-rey': { vivienda: 'mixta', nota: 'Casco tradicional, barrios de pisos de los años 70 y 80 y promociones más recientes, junto a un polígono industrial con mucha actividad de talleres, almacenes y transporte.' },
  leganes: { vivienda: 'mixta', nota: 'Barrios de bloques de los años 60 y 70 como Zarzaquemada, San Nicasio o La Fortuna, muchos con comunidades renovando ascensores y fachadas, y desarrollos más recientes en Leganés Norte y Arroyo Culebro.' },
  valdemoro: { vivienda: 'nueva', nota: 'Ha multiplicado su población desde los años 90: buena parte de las viviendas son pisos y adosados de las últimas décadas, como los de El Restón, alrededor de un casco antiguo pequeño.' },
  alcorcon: { vivienda: 'mixta', nota: 'Grandes barrios de bloques de los años 60 y 70, como Parque Lisboa, Parque de Ondarreta o San José de Valderas, y el Ensanche Sur, mucho más reciente.' },
  parla: { vivienda: 'mixta', nota: 'Bloques de los años 70 y 80 en el centro y Parla Este, un desarrollo de la década de 2000 con edificios recientes y calles amplias.' },
  getafe: { vivienda: 'mixta', nota: 'Ciudad industrial del sur con barrios de los años 60 y 70 como Las Margaritas, Juan de la Cierva o La Alhóndiga, y desarrollos recientes en El Bercial, Getafe Norte y Los Molinos.' },
  pinto: { vivienda: 'mixta', nota: 'Casco antiguo con vivienda tradicional y barrios de pisos y adosados construidos sobre todo desde los años 90, con polígonos industriales a las afueras.' },
  'san-sebastian-de-los-reyes': { vivienda: 'mixta', nota: 'Casco antiguo, barrios de los años 70 y 80 y desarrollos recientes como Dehesa Vieja o Tempranales, donde muchos pisos tienen menos de 25 años.' },
  'torrejon-de-ardoz': { vivienda: 'mixta', nota: 'Bloques de los años 60 y 70 en el centro y barrios nuevos como Soto Henares o Parque Cataluña, en una de las ciudades más pobladas del Corredor del Henares.' },
  'pozuelo-de-alarcon': { vivienda: 'nueva', nota: 'Mucha vivienda unifamiliar y urbanizaciones como Somosaguas, Monteclaro o La Finca, junto al casco del pueblo y la zona de la estación. Las reformas de gama alta, los jardines y las piscinas son trabajos habituales.' },
  coslada: { vivienda: 'mixta', nota: 'Creció en los años 70 con bloques de pisos en Valleaguado o La Rambla, a los que se sumó después el Barrio del Puerto; al lado está el Puerto Seco, un gran centro logístico.' },
  'rivas-vaciamadrid': { vivienda: 'nueva', nota: 'Casi toda la vivienda tiene menos de 35 años: pisos y adosados en Rivas Urbanizaciones, Covibar o Rivas Futura, muchos levantados en cooperativa.' },
  'san-fernando-de-henares': { vivienda: 'mixta', nota: 'Casco histórico en torno a la plaza de España y barrios de pisos de los años 70 y 80, con zonas industriales y logísticas cerca de la A-2.' },
  'colmenar-viejo': { vivienda: 'mixta', nota: 'Pueblo grande de la sierra con casco de casas de piedra, barrios de pisos y muchas urbanizaciones. Los inviernos son fríos, así que la calefacción y el aislamiento pesan más que en la capital.' },
  'humanes-de-madrid': { vivienda: 'mixta', nota: 'Casco tradicional, pisos y adosados recientes, y grandes polígonos industriales con muchas empresas de transporte, talleres e instaladores.' },
  alcobendas: { vivienda: 'mixta', nota: 'Bloques de los años 60 y 70 en el centro, desarrollos recientes en Valdelasfuentes y El Juncal, y urbanizaciones de lujo como La Moraleja.' },
  'boadilla-del-monte': { vivienda: 'nueva', nota: 'Municipio de urbanizaciones, como Las Lomas, Parque Boadilla, Valdecabañas o Montepríncipe, y pisos recientes en el casco y Viñas Viejas. Predomina la vivienda unifamiliar con jardín.' },
  majadahonda: { vivienda: 'nueva', nota: 'Chalets, adosados y urbanizaciones como Roza Martín, junto a un centro de pisos de los años 70 y 80 y promociones más recientes.' },
  aranjuez: { vivienda: 'mixta', nota: 'El centro histórico, con el Palacio Real, forma parte de un Paisaje Cultural Patrimonio de la Humanidad: en los edificios protegidos las obras exteriores necesitan permiso específico. Fuera del casco hay barrios de pisos y desarrollos nuevos como La Montaña.' },
  arroyomolinos: { vivienda: 'nueva', nota: 'Uno de los municipios que más ha crecido en la Comunidad: casi todo son adosados y pisos construidos desde finales de los años 90.' },
  navalcarnero: { vivienda: 'mixta', nota: 'Casco histórico con plaza porticada y casas tradicionales, y urbanizaciones y adosados en las afueras.' },
  'tres-cantos': { vivienda: 'mixta', nota: 'Ciudad planificada que se construyó por sectores desde finales de los años 70, con mucha vivienda en cooperativa y zonas verdes. Los pisos más antiguos ya superan los 40 años y empiezan a renovar instalaciones.' },
  'villaviciosa-de-odon': { vivienda: 'nueva', nota: 'Urbanizaciones de chalets como El Bosque y un casco con pisos y adosados, con mucha vivienda con jardín.' },
  'paracuellos-de-jarama': { vivienda: 'nueva', nota: 'Ha crecido mucho en las dos últimas décadas con Miramadrid, un desarrollo de pisos y adosados recientes, junto al casco antiguo.' },
  'villanueva-de-la-canada': { vivienda: 'nueva', nota: 'Urbanizaciones como Villafranca del Castillo y un casco con muchos adosados, en una zona de vivienda unifamiliar con jardín.' },
};

module.exports = { MUNICIPIOS };
