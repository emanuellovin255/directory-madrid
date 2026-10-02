/* =========================================================================
   content/distritos.js — Notas locales de los 21 distritos de Madrid capital.

   Se combinan con la nota del servicio según el tipo de vivienda dominante
   (categorias.js → porVivienda) y con datos reales del directorio (nº de
   empresas, barrios con más profesionales). Así cada página servicio×distrito
   tiene contenido propio y no una frase de plantilla.

   vivienda: 'antigua' (fincas de antes de 1950), 'mixta' (bloques de los años
   50-70 junto a algo más reciente) o 'nueva' (desarrollos de los últimos 25 años).
   ========================================================================= */
'use strict';

const DISTRITOS = {
  centro: { vivienda: 'antigua', nota: 'Edificios de los siglos XIX y XX, muchos sin ascensor y con portales estrechos, en calles con acceso restringido al tráfico. Para cualquier trabajo con furgoneta conviene preguntar antes cómo se resuelve la carga y descarga.' },
  arganzuela: { vivienda: 'mixta', nota: 'Bloques de los años 50 a 70 en Delicias, Palos de Moguer o Acacias conviven con promociones recientes junto a Madrid Río.' },
  retiro: { vivienda: 'mixta', nota: 'Fincas clásicas en Ibiza y Niño Jesús y bloques de los años 60 y 70 en Adelfas, Estrella o Pacífico.' },
  salamanca: { vivienda: 'antigua', nota: 'Fincas señoriales de techos altos en Recoletos, Castellana o Goya, con muchas reformas integrales de gama alta y comunidades exigentes con horarios y ruidos.' },
  chamartin: { vivienda: 'mixta', nota: 'Pisos de los años 50 a 70 en Prosperidad, Ciudad Jardín o Hispanoamérica, junto a los edificios de oficinas del eje de la Castellana.' },
  tetuan: { vivienda: 'antigua', nota: 'Calles estrechas con edificios antiguos en Bellas Vistas, Berruguete o Valdeacederas, en plena renovación, junto a las torres de oficinas de la Castellana.' },
  chamberi: { vivienda: 'antigua', nota: 'Edificios de principios del siglo XX en Trafalgar, Almagro o Arapiles. Muchas reformas de pisos antiguos que aún conservan instalaciones originales.' },
  'fuencarral-el-pardo': { vivienda: 'nueva', nota: 'Distrito muy extenso: barrios de los años 70 en El Pilar o Peñagrande y desarrollos recientes como Montecarmelo, Las Tablas o Arroyo del Fresno.' },
  'moncloa-aravaca': { vivienda: 'mixta', nota: 'Desde pisos clásicos en Argüelles hasta chalets y urbanizaciones en Aravaca, con mucha vivienda unifamiliar con jardín.' },
  latina: { vivienda: 'mixta', nota: 'Bloques de los años 50 a 70 en Lucero, Aluche o Puerta del Ángel, muchos sin ascensor de origen y con comunidades que están rehabilitando fachadas.' },
  carabanchel: { vivienda: 'mixta', nota: 'Bloques de los años 50 a 70 en Opañel, Vista Alegre o Puerta Bonita, junto a las promociones nuevas del PAU de Carabanchel.' },
  usera: { vivienda: 'mixta', nota: 'Edificios de los años 50 a 70 en Moscardó, Almendrales o Pradolongo, con mucha vivienda pequeña en reforma.' },
  'puente-de-vallecas': { vivienda: 'mixta', nota: 'Uno de los distritos más poblados de Madrid, con bloques de los años 50 a 70 en Numancia, San Diego o Entrevías.' },
  moratalaz: { vivienda: 'mixta', nota: 'Barrio planificado en los años 60 y 70, de bloques parecidos entre sí, con muchas comunidades renovando bajantes, ascensores y calefacción.' },
  'ciudad-lineal': { vivienda: 'mixta', nota: 'Pisos de los años 60 y 70 en Pueblo Nuevo, Quintana o Concepción, junto a colonias de viviendas unifamiliares.' },
  hortaleza: { vivienda: 'nueva', nota: 'Barrios de los años 70 en Canillas o San Lorenzo junto a desarrollos recientes como Sanchinarro y Valdebebas, con muchas urbanizaciones y unifamiliares.' },
  villaverde: { vivienda: 'mixta', nota: 'Bloques de los años 50 a 70 en San Cristóbal, Villaverde Alto o Los Rosales, y una zona industrial con muchos talleres y naves.' },
  'villa-de-vallecas': { vivienda: 'nueva', nota: 'El casco histórico de Vallecas convive con el Ensanche de Vallecas, donde la mayoría de los edificios tienen menos de 20 años.' },
  vicalvaro: { vivienda: 'nueva', nota: 'Casco antiguo y barrios de los años 70, más los desarrollos nuevos de Valdebernardo y El Cañaveral.' },
  'san-blas-canillejas': { vivienda: 'mixta', nota: 'Bloques de los años 60 y 70 en Simancas o Amposta y promociones recientes en Las Rosas y Rejas.' },
  barajas: { vivienda: 'mixta', nota: 'Casco histórico, la Alameda de Osuna y urbanizaciones junto al aeropuerto, con bastante vivienda unifamiliar.' },
};

module.exports = { DISTRITOS };
