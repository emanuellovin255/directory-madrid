/* =========================================================================
   seed.js — Populează DB la prima pornire (dacă e gol):
   3 clinici demo (fictive, cartiere reale Madrid) + istoric de vizite.
   ========================================================================= */
'use strict';
const DB = require('./db');

const DEMO_CLINICS = [
  {
    id: 'serrano',
    name: 'Clínica Dental Serrano',
    zone: 'Barrio de Salamanca',
    address: 'Calle de Serrano 45, 28001 Madrid',
    about: 'En Clínica Dental Serrano combinamos tecnología de última generación con un trato cercano y personalizado. Nuestro equipo de especialistas te acompaña en cada paso, desde la primera visita hasta el resultado final, con un enfoque en la estética y la salud a largo plazo.',
    services: ['Implantología', 'Ortodoncia invisible', 'Estética dental', 'Blanqueamiento', 'Periodoncia', 'Odontología general'],
    hours: { lunes: '09:00 – 20:00', martes: '09:00 – 20:00', miercoles: '09:00 – 20:00', jueves: '09:00 – 20:00', viernes: '09:00 – 20:00', sabado: '10:00 – 14:00', domingo: 'Cerrado' },
    phone: '+34 910 000 001', email: 'info@clinicaserrano.example.com', website: 'https://clinicaserrano.example.com',
    social: { instagram: 'https://instagram.com/clinicaserrano', facebook: 'https://facebook.com/clinicaserrano' },
    rating: 4.9, reviews: 213, featured: true, photo: null,
  },
  {
    id: 'sonrisa-chamberi',
    name: 'Sonrisa Chamberí',
    zone: 'Chamberí',
    address: 'Calle de Trafalgar 22, 28010 Madrid',
    about: 'Sonrisa Chamberí es una clínica familiar donde cuidamos de la salud bucodental de todas las edades. Apostamos por la prevención y la odontología conservadora, en un ambiente acogedor pensado también para los más pequeños.',
    services: ['Odontología familiar', 'Odontopediatría', 'Prevención', 'Endodoncia', 'Ortodoncia', 'Higiene dental'],
    hours: { lunes: '09:30 – 19:30', martes: '09:30 – 19:30', miercoles: '09:30 – 19:30', jueves: '09:30 – 19:30', viernes: '09:30 – 19:30', sabado: '10:00 – 13:30', domingo: 'Cerrado' },
    phone: '+34 910 000 002', email: 'hola@sonrisachamberi.example.com', website: 'https://sonrisachamberi.example.com',
    social: { instagram: 'https://instagram.com/sonrisachamberi', facebook: 'https://facebook.com/sonrisachamberi' },
    rating: 4.7, reviews: 156, featured: false, photo: null,
  },
  {
    id: 'malasana-studio',
    name: 'Malasaña Dental Studio',
    zone: 'Malasaña · Centro',
    address: 'Calle de la Palma 18, 28004 Madrid',
    about: 'Malasaña Dental Studio es un espacio moderno especializado en estética y diseño de sonrisa. Utilizamos escáner digital y flujo totalmente digital para ofrecerte resultados naturales, con la máxima comodidad y en menos visitas.',
    services: ['Estética dental', 'Blanqueamiento', 'Carillas', 'Ortodoncia invisible', 'Diseño de sonrisa', 'Odontología general'],
    hours: { lunes: '10:00 – 20:00', martes: '10:00 – 20:00', miercoles: '10:00 – 20:00', jueves: '10:00 – 20:00', viernes: '10:00 – 20:00', sabado: '11:00 – 15:00', domingo: 'Cerrado' },
    phone: '+34 910 000 003', email: 'hello@malasanadental.example.com', website: 'https://malasanadental.example.com',
    social: { instagram: 'https://instagram.com/malasanadental', tiktok: 'https://tiktok.com/@malasanadental' },
    rating: 4.8, reviews: 98, featured: true, photo: null,
  },
];

function tsInMonth(delta, nowD) {
  // timestamp (secunde) aleator într-o lună aflată `delta` luni în urmă
  const base = new Date(nowD.getFullYear(), nowD.getMonth() - delta, 1);
  const start = base.getTime();
  let end;
  if (delta === 0) end = nowD.getTime();
  else end = new Date(nowD.getFullYear(), nowD.getMonth() - delta + 1, 1).getTime();
  return Math.floor((start + Math.random() * (end - start)) / 1000);
}

function seedIfEmpty() {
  const seededClinics = DB.countClinics() === 0;
  const seededEvents = DB.countEvents() === 0;

  if (seededClinics) {
    DEMO_CLINICS.forEach(c => DB.insertClinic(c, c.id));
    console.log('  ↳ Sembradas 3 clínicas demo');
  }

  if (seededEvents) {
    const nowD = new Date();
    // Vizite istorice pe luni (acum 6 luni → luna curentă)
    const visits = { 6: 468, 5: 552, 4: 610, 3: 703, 2: 795, 1: 910, 0: 214 };
    // Vizualizări de fișă pe clinică (ultimele ~2 luni)
    const views = { 'serrano': 1240, 'malasana-studio': 980, 'sonrisa-chamberi': 760 };
    // Clicuri de contact
    const contactPhone = 342, contactWeb = 289;

    DB.db.exec('BEGIN');
    try {
      Object.keys(visits).forEach(delta => {
        const d = Number(delta), n = visits[delta];
        for (let i = 0; i < n; i++) DB.recordEvent('visit', null, tsInMonth(d, nowD));
      });
      Object.keys(views).forEach(id => {
        for (let i = 0; i < views[id]; i++) DB.recordEvent('view', id, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD));
      });
      for (let i = 0; i < contactPhone; i++) DB.recordEvent('contact_phone', null, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD));
      for (let i = 0; i < contactWeb; i++) DB.recordEvent('contact_web', null, tsInMonth(Math.random() < 0.5 ? 0 : 1, nowD));
      DB.db.exec('COMMIT');
    } catch (e) { DB.db.exec('ROLLBACK'); throw e; }
    console.log('  ↳ Sembrado histórico de analítica (demo)');
  }

  return { seededClinics, seededEvents };
}

module.exports = { seedIfEmpty, DEMO_CLINICS };
