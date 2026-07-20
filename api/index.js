/* Intrarea serverless pentru Vercel.
   Express `app` este el însuși un handler (req, res) → îl reexportăm.
   Bootstrap-ul (hidratare Postgres + seed) e gestionat în server.js printr-un
   middleware care așteaptă `ready` înainte de a servi prima cerere. */
'use strict';
module.exports = require('../server/server.js');
