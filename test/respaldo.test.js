// NF-10: respaldo y recuperación (NFR-SEG-7)
const fs = require('fs'); const os = require('os'); const path = require('path');
const request = require('supertest');
const { crearApp } = require('../src/app');
const { respaldar, restaurar } = require('../scripts/respaldo');
const { DatabaseSync } = require('node:sqlite');

test('NF-10 respaldo y restauracion recuperan datos y documentos tras perdida total', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramoya-'));
  const dbRuta = path.join(dir, 'prod.db'); const storage = path.join(dir, 'storage');
  const { app } = crearApp({ dbRuta, storageDir: storage });
  const pass = 'Clave-Segura-2026!';
  await request(app).post('/api/auth/register').send({ usuario: 'ana', correo: 'ana@x.cl', password: pass });
  const tok = (await request(app).post('/api/auth/login').send({ usuario: 'ana', password: pass })).body.token;
  const H = { Authorization: 'Bearer ' + tok };
  const emp = (await request(app).post('/api/productoras').set(H).send({ nombre: 'Aurora', direccion: 'Av 1', telefono: '221234567', correo: 'c@a.cl' })).body;
  const cli = (await request(app).post(`/api/productoras/${emp.id}/clientes`).set(H).send({ tipo: 'empresa', rut: '76.086.428-5', nombre: 'Alfa', descripcion: 'x', direccion: 'y', contacto: 'z' })).body;
  const ev = (await request(app).post('/api/eventos').set(H).send({ cliente_id: cli.id, titulo: 'E1', descripcion: 'd', fecha_evento: '2027-01-01', recinto: 'Teatro', aforo: 300, monto: 1200000 })).body;
  await request(app).post(`/api/eventos/${ev.id}/documentos`).set(H).field('tipo', 'contrato').attach('archivo', Buffer.from('%PDF-1.4 contenido'), 'contrato.pdf');
  const contar = (r) => { const d = new DatabaseSync(r); const n = ['usuarios', 'productoras', 'clientes', 'eventos', 'documentos'].map((t) => d.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n); d.close(); return n; };
  expect((await request(app).get(`/api/productoras/${emp.id}/clientes`).set(H)).body).toBeTruthy();
  const antes = contar(dbRuta);
  expect(antes).toEqual([1, 1, 1, 1, 1]); const archivos = fs.readdirSync(storage).sort();

  const t0 = Date.now();
  respaldar(dbRuta, storage, path.join(dir, 'resp'));
  fs.rmSync(dbRuta); fs.rmSync(storage, { recursive: true }); // desastre simulado
  restaurar(path.join(dir, 'resp'), dbRuta, storage);
  const rto = Date.now() - t0;
  console.log('NF-10 tiempo respaldo+restauracion (ms):', rto, '| filas antes:', antes);
  expect(contar(dbRuta)).toEqual(antes);
  expect(fs.readdirSync(storage).sort()).toEqual(archivos);
  expect(rto).toBeLessThan(5000);
});

test('NF-10 un respaldo alterado es rechazado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramoya-'));
  const { app } = crearApp({ dbRuta: path.join(dir, 'a.db'), storageDir: path.join(dir, 's') });
  expect(app).toBeTruthy();
  respaldar(path.join(dir, 'a.db'), path.join(dir, 's'), path.join(dir, 'r'));
  fs.appendFileSync(path.join(dir, 'r', 'tramoya.db'), 'x');
  expect(() => restaurar(path.join(dir, 'r'), path.join(dir, 'b.db'), path.join(dir, 's2'))).toThrow(/corrupto/);
});
