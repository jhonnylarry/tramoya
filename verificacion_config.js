// Script de revision de configuracion de seguridad (genera evidencia/manual.txt)
const request = require('supertest');
const { crearApp } = require('./src/app');
(async () => {
  const { app } = crearApp({ storageDir: require('os').tmpdir() + '/tramoya-ev' });
  await request(app).post('/api/auth/register').send({ usuario: 'ana', password: 'Clave-Segura-2026!', correo: 'a@a.cl' });
  const estados = [];
  for (let i = 0; i < 30; i++) estados.push((await request(app).post('/api/auth/login').send({ usuario: 'ana', password: 'mala' + i })).status);
  const ok = await request(app).post('/api/auth/login').send({ usuario: 'ana', password: 'Clave-Segura-2026!' });
  console.log('EV-BRUTA: 30 intentos fallidos ->', [...new Set(estados)].join(','), '| login correcto tras 30 fallos ->', ok.status);
  const h = (await request(app).get('/api/health')).headers;
  console.log('EV-HEADERS:', JSON.stringify({ 'x-powered-by': h['x-powered-by'], 'strict-transport-security': h['strict-transport-security'], 'x-content-type-options': h['x-content-type-options'], 'content-security-policy': h['content-security-policy'], 'access-control-allow-origin': h['access-control-allow-origin'] }));
  // EV-ENLACE: el enlace de cotizacion deberia vencer a los 7 dias y poder revocarse (RB-8, RF-5.5)
  const H = { Authorization: 'Bearer ' + ok.body.token };
  const p = (await request(app).post('/api/productoras').set(H).send({ nombre: 'Prod', direccion: 'Calle 1', telefono: '221234567', correo: 'p@p.cl' })).body;
  const c = (await request(app).post(`/api/productoras/${p.id}/clientes`).set(H).send({ tipo: 'persona', rut: '12.345.678-5', nombre: 'Ana' })).body;
  const ev = (await request(app).post('/api/eventos').set(H).send({ cliente_id: c.id, titulo: 'Boda', fecha_evento: '2027-02-01', recinto: 'Casona', aforo: 120, monto: 2500000 })).body;
  await request(app).post(`/api/eventos/${ev.id}/documentos`).set(H).field('tipo', 'cotizacion').attach('archivo', Buffer.from('%PDF-1.4 x'), 'cot.pdf');
  const url = (await request(app).post(`/api/eventos/${ev.id}/compartir`).set(H)).body.url;
  const realNow = Date.now;
  Date.now = () => realNow() + 8 * 86400000; // simula 8 dias despues
  const tarde = await request(app).get(url);
  Date.now = realNow;
  const rutas = app._router.stack.filter((l) => l.route).map((l) => Object.keys(l.route.methods)[0].toUpperCase() + ' ' + l.route.path);
  console.log('EV-ENLACE: descarga 8 dias despues ->', tarde.status, '| ruta de revocacion:', rutas.some((r) => /revocar|DELETE .*cotizacion|DELETE .*enlace/.test(r)) ? 'existe' : 'no existe');
  try { require('jsonwebtoken').verify(ok.body.token, 'tramoya-dev-secret'); console.log('EV-SECRET: token valido con el secreto por defecto (sin JWT_SECRET definido)'); } catch (e) { console.log('secreto distinto'); }
})();
