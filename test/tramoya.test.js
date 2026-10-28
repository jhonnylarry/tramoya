const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearApp } = require('../src/app');
const { calcularEstado } = require('../src/eventos');

const PW = 'Clave-Segura-2026!';
const PDF = Buffer.from('%PDF-1.4 prueba');
let app, db;

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramoya-'));
  ({ app, db } = crearApp({ storageDir: dir }));
});

async function registrar(usuario, correo = `${usuario}@mail.cl`) {
  await request(app).post('/api/auth/register').send({ usuario, password: PW, correo });
  const r = await request(app).post('/api/auth/login').send({ usuario, password: PW });
  return r.body.token;
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
async function productora(token, correo = 'contacto@productora.cl') {
  const r = await request(app).post('/api/productoras').set(auth(token))
    .send({ nombre: 'Producciones Sur', direccion: 'Av. Matta 456', telefono: '221234567', correo });
  return r.body.id;
}
const datosCliente = (extra = {}) => ({ tipo: 'empresa', rut: '76.086.428-5', nombre: 'Feria Raices', descripcion: 'x', direccion: 'y', contacto: 'z', ...extra });
async function cliente(token, pid, nombre = 'Feria Raices') {
  const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(token)).send(datosCliente({ nombre }));
  return r.body.id;
}
const datosEvento = (cid, extra = {}) => ({ cliente_id: cid, titulo: 'Feria de invierno', descripcion: 'd', fecha_evento: '2027-07-10', recinto: 'Centro Cultural Estacion', aforo: 800, monto: 4500000, ...extra });
async function evento(token, cid, extra) {
  const r = await request(app).post('/api/eventos').set(auth(token)).send(datosEvento(cid, extra));
  return r.body.id;
}
const adjuntar = (token, eid, tipo, buf = PDF, nombre = `${tipo}.pdf`) =>
  request(app).post(`/api/eventos/${eid}/documentos`).set(auth(token)).field('tipo', tipo).attach('archivo', buf, nombre);
async function conEvento(extra) {
  const t = await registrar('ana'); const pid = await productora(t); const cid = await cliente(t, pid);
  const eid = await evento(t, cid, extra);
  return { t, pid, cid, eid };
}

describe('RF-1 Autenticacion y sesion', () => {
  test('CP-01 RF-1.1 login exitoso entrega JWT', async () => {
    const t = await registrar('ana');
    expect(t.split('.')).toHaveLength(3);
  });
  test('CP-02 RF-1.1 login con clave incorrecta es rechazado sin revelar el motivo', async () => {
    await registrar('ana');
    const r = await request(app).post('/api/auth/login').send({ usuario: 'ana', password: 'otra' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Credenciales invalidas');
  });
  test('CP-03 RF-1.2 logout revoca el token', async () => {
    const t = await registrar('ana');
    await request(app).post('/api/auth/logout').set(auth(t));
    const r = await request(app).post('/api/productoras').set(auth(t)).send({});
    expect(r.status).toBe(401);
  });
  test('CP-04 NFR-SEG-9 sin token no se accede a recursos', async () => {
    const r = await request(app).get('/api/productoras/1/clientes');
    expect(r.status).toBe(401);
  });
});

describe('RF-2 Registro y productora', () => {
  test('CP-05 NFR-SEG-2 la contrasena se guarda con hash bcrypt', async () => {
    await registrar('ana');
    const u = db.prepare('SELECT password_hash FROM usuarios WHERE usuario=?').get('ana');
    expect(u.password_hash).toMatch(/^\$2[aby]\$/);
    expect(u.password_hash).not.toContain(PW);
  });
  test('CP-06 RF-2.1 politica de contrasenas (12 car, may, min, num, simbolo)', async () => {
    for (const malo of ['corta1A!', 'sinmayusculas123!', 'SINMINUSCULAS123!', 'SinNumeroNiSimbolo', 'SinSimbolo12345A']) {
      const r = await request(app).post('/api/auth/register').send({ usuario: 'x1', password: malo, correo: 'x@y.cl' });
      expect(r.status).toBe(400);
    }
  });
  test('CP-07 RF-2.2/2.3 quien crea la productora queda como administrador', async () => {
    const t = await registrar('ana');
    const r = await request(app).post('/api/productoras').set(auth(t))
      .send({ nombre: 'Producciones Sur', direccion: 'Calle 1', telefono: '221234567', correo: 'a@prod.cl' });
    expect(r.status).toBe(201);
    expect(r.body.rol).toBe('administrador');
  });
  test('CP-08 RB-1 correo de productora no puede repetirse', async () => {
    const t = await registrar('ana');
    await productora(t, 'dup@prod.cl');
    const r = await request(app).post('/api/productoras').set(auth(t))
      .send({ nombre: 'Otra', direccion: 'Calle 2', telefono: '221234567', correo: 'dup@prod.cl' });
    expect(r.status).toBe(409);
  });
});

describe('RF-3 Roles', () => {
  async function conCoordinador() {
    const tAdmin = await registrar('admin1');
    const pid = await productora(tAdmin);
    const tCo = await registrar('coord1');
    await request(app).post(`/api/productoras/${pid}/usuarios`).set(auth(tAdmin)).send({ usuario: 'coord1', rol: 'coordinador' });
    return { tAdmin, tCo, pid };
  }
  test('CP-09 RF-3.1 admin asigna rol coordinador y este puede consultar', async () => {
    const { tCo, pid } = await conCoordinador();
    const r = await request(app).get(`/api/productoras/${pid}/clientes`).set(auth(tCo));
    expect(r.status).toBe(200);
  });
  test('CP-10 RF-3.2 / RB-4 coordinador no puede crear clientes', async () => {
    const { tCo, pid } = await conCoordinador();
    const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(tCo)).send(datosCliente({ nombre: 'Nuevo' }));
    expect(r.status).toBe(403);
  });
  test('CP-11 RF-3.3 admin quita a un usuario de la productora', async () => {
    const { tAdmin, pid } = await conCoordinador();
    const uid = db.prepare("SELECT id FROM usuarios WHERE usuario='coord1'").get().id;
    const r = await request(app).delete(`/api/productoras/${pid}/usuarios/${uid}`).set(auth(tAdmin));
    expect(r.status).toBe(200);
  });
  test('CP-12 RB-2 usuario de otra productora no accede a datos (aislamiento)', async () => {
    const tA = await registrar('admin1'); const pA = await productora(tA, 'a@prod.cl');
    const idCliente = await cliente(tA, pA);
    const tB = await registrar('admin2'); await productora(tB, 'b@prod.cl');
    const r1 = await request(app).get(`/api/productoras/${pA}/clientes`).set(auth(tB));
    const r2 = await request(app).put(`/api/clientes/${idCliente}`).set(auth(tB)).send(datosCliente({ nombre: 'Hack' }));
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
  });
});

describe('RF-4 Clientes organizadores', () => {
  test('CP-13 RF-4.1 crear y listar con paginacion y filtro', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    for (let i = 0; i < 12; i++) await cliente(t, pid, `Cliente ${i}`);
    const p1 = await request(app).get(`/api/productoras/${pid}/clientes?pagina=1&tam=10`).set(auth(t));
    const p2 = await request(app).get(`/api/productoras/${pid}/clientes?pagina=2&tam=10`).set(auth(t));
    const f = await request(app).get(`/api/productoras/${pid}/clientes?nombre=Cliente 11`).set(auth(t));
    expect(p1.body.datos).toHaveLength(10);
    expect(p2.body.datos).toHaveLength(2);
    expect(f.body.datos).toHaveLength(1);
    expect(f.body.datos[0]).toMatchObject({ tipo: 'empresa', rut: '76086428-5' });
  });
  test('CP-14 RF-4.3 validacion de campos (nombre con caracteres no permitidos)', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ nombre: 'Cliente <script>' }));
    expect(r.status).toBe(400);
  });
  test('CP-15 RF-4.2 eliminacion logica exige confirmacion', async () => {
    const t = await registrar('ana'); const pid = await productora(t); const id = await cliente(t, pid);
    const sin = await request(app).delete(`/api/clientes/${id}`).set(auth(t));
    expect(sin.status).toBe(400);
    const con = await request(app).delete(`/api/clientes/${id}?confirmar=true`).set(auth(t));
    expect(con.status).toBe(200);
    const fila = db.prepare('SELECT activo FROM clientes WHERE id=?').get(id);
    expect(fila.activo).toBe(0); // sigue en BD (logica)
  });
  test('CP-16 NFR-SEG-5 SQL injection en filtro no altera la consulta', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    await cliente(t, pid, 'Alfa');
    const r = await request(app).get(`/api/productoras/${pid}/clientes`).query({ nombre: "' OR '1'='1" }).set(auth(t));
    expect(r.status).toBe(200);
    expect(r.body.datos).toHaveLength(0);
  });
  test('CP-17 NFR-SEG-5 XSS en campo libre se almacena escapado', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ nombre: 'Beta', descripcion: '<img src=x onerror=alert(1)>' }));
    const fila = db.prepare('SELECT descripcion FROM clientes WHERE id=?').get(r.body.id);
    expect(fila.descripcion).not.toContain('<');
  });
  test('CP-31 RF-4.3 RUT con digito verificador incorrecto es rechazado', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    for (const rut of ['76.086.428-4', '12345678-K', '1234-5', 'abc']) {
      const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ rut }));
      expect(r.status).toBe(400);
    }
    const ok = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ tipo: 'persona', rut: '12.345.678-5' }));
    expect(ok.status).toBe(201);
  });
  test('CP-32 RF-4.3 tipo de cliente distinto de persona o empresa es rechazado', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ tipo: 'fundacion' }));
    expect(r.status).toBe(400);
  });
});

describe('RF-5 Eventos, cotizacion y contrato', () => {
  test('CP-18 RF-5.1 / RB-3 crear evento asociado a un cliente queda cotizado', async () => {
    const t = await registrar('ana'); const pid = await productora(t); const cid = await cliente(t, pid);
    const r = await request(app).post('/api/eventos').set(auth(t)).send(datosEvento(cid));
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('cotizado');
  });
  test('CP-19 RF-5.1 fecha, recinto o aforo invalidos son rechazados', async () => {
    const t = await registrar('ana'); const pid = await productora(t); const cid = await cliente(t, pid);
    for (const extra of [{ fecha_evento: '10-07-2027' }, { recinto: '' }, { aforo: 0 }, { aforo: 12.5 }]) {
      const r = await request(app).post('/api/eventos').set(auth(t)).send(datosEvento(cid, extra));
      expect(r.status).toBe(400);
    }
  });
  test('CP-20 RF-5.4 estado del evento segun confirmacion y fecha', () => {
    const hoy = new Date('2026-10-28T12:00:00Z');
    expect(calcularEstado('2026-11-15', false, hoy)).toBe('cotizado');
    expect(calcularEstado('2026-11-15', true, hoy)).toBe('proximo');
    expect(calcularEstado('2026-11-27', true, hoy)).toBe('proximo');
    expect(calcularEstado('2026-11-28', true, hoy)).toBe('confirmado');
    expect(calcularEstado('2026-10-27', true, hoy)).toBe('realizado');
    expect(calcularEstado('2026-10-28', true, hoy)).toBe('proximo');
  });
  test('CP-21 RF-5.2/5.3 subir contrato PDF, se guarda en storage interno y se referencia en BD', async () => {
    const { t, eid } = await conEvento();
    const r = await adjuntar(t, eid, 'contrato');
    expect(r.status).toBe(201);
    const d = db.prepare('SELECT ruta, tipo FROM documentos WHERE id=?').get(r.body.id);
    expect(d.ruta).toMatch(/\.pdf$/);
    expect(d.tipo).toBe('contrato');
    const repetido = await adjuntar(t, eid, 'contrato');
    expect(repetido.status).toBe(409);
  });
  test('CP-22 RF-5.2 formato no permitido (.exe o PDF falso) es rechazado', async () => {
    const { t, eid } = await conEvento();
    const exe = await adjuntar(t, eid, 'contrato', Buffer.from('MZ'), 'malo.exe');
    const falso = await adjuntar(t, eid, 'contrato', Buffer.from('MZ ejecutable'), 'contrato.pdf');
    expect(exe.status).toBe(400);
    expect(falso.status).toBe(400);
  });
  test('CP-23 RF-5.5 enlace de cotizacion descarga la cotizacion', async () => {
    const { t, eid } = await conEvento();
    await adjuntar(t, eid, 'cotizacion');
    const l = await request(app).post(`/api/eventos/${eid}/compartir`).set(auth(t));
    expect(l.status).toBe(201);
    const d = await request(app).get(l.body.url);
    expect(d.status).toBe(200);
  });
  test('CP-24 NFR-SEG-4 descarga de documento de otra productora es denegada', async () => {
    const { t, eid } = await conEvento();
    const up = await adjuntar(t, eid, 'contrato');
    const t2 = await registrar('otro'); await productora(t2, 'o@prod.cl');
    const r = await request(app).get(`/api/documentos/${up.body.id}`).set(auth(t2));
    expect(r.status).toBe(403);
  });
  test('CP-33 RB-8 monto que no es entero positivo en pesos es rechazado', async () => {
    const t = await registrar('ana'); const pid = await productora(t); const cid = await cliente(t, pid);
    for (const monto of [0, -1000, 1500.5, '4500000', null]) {
      const r = await request(app).post('/api/eventos').set(auth(t)).send(datosEvento(cid, { monto }));
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Monto invalido');
    }
  });
  test('CP-34 RB-7 un evento no se confirma sin contrato PDF adjunto', async () => {
    const { t, eid } = await conEvento();
    await adjuntar(t, eid, 'cotizacion');
    const sin = await request(app).post(`/api/eventos/${eid}/confirmar`).set(auth(t));
    expect(sin.status).toBe(409);
    expect(sin.body.error).toBe('El evento no tiene contrato adjunto');
    await adjuntar(t, eid, 'contrato');
    const con = await request(app).post(`/api/eventos/${eid}/confirmar`).set(auth(t));
    expect(con.status).toBe(200);
    expect(con.body.estado).toBe('confirmado');
  });
  test('CP-35 RB-6 no se confirman dos eventos en el mismo recinto y fecha', async () => {
    const { t, cid, eid } = await conEvento();
    const e2 = await evento(t, cid, { titulo: 'Concierto', recinto: 'centro cultural estacion' });
    const e3 = await evento(t, cid, { titulo: 'Matrimonio', fecha_evento: '2027-07-11' });
    for (const id of [eid, e2, e3]) await adjuntar(t, id, 'contrato');
    expect((await request(app).post(`/api/eventos/${eid}/confirmar`).set(auth(t))).status).toBe(200);
    const choque = await request(app).post(`/api/eventos/${e2}/confirmar`).set(auth(t));
    expect(choque.status).toBe(409);
    expect(choque.body.error).toBe('Recinto ocupado en esa fecha');
    expect((await request(app).post(`/api/eventos/${e3}/confirmar`).set(auth(t))).status).toBe(200);
  });
  test('CP-36 RB-4 coordinador no puede confirmar eventos ni adjuntar documentos', async () => {
    const { t, pid, eid } = await conEvento();
    const tCo = await registrar('coord1');
    await request(app).post(`/api/productoras/${pid}/usuarios`).set(auth(t)).send({ usuario: 'coord1', rol: 'coordinador' });
    expect((await adjuntar(tCo, eid, 'contrato')).status).toBe(403);
    expect((await request(app).post(`/api/eventos/${eid}/confirmar`).set(auth(tCo))).status).toBe(403);
  });
  test('CP-37 RF-5.5 sin cotizacion no se genera enlace (el contrato no se comparte)', async () => {
    const { t, eid } = await conEvento();
    await adjuntar(t, eid, 'contrato');
    const l = await request(app).post(`/api/eventos/${eid}/compartir`).set(auth(t));
    expect(l.status).toBe(404);
  });
});

describe('RF-6 Auditoria', () => {
  test('CP-25 RF-6.1 acciones criticas quedan registradas', async () => {
    const { t, pid, cid, eid } = await conEvento();
    await adjuntar(t, eid, 'contrato');
    await request(app).post(`/api/eventos/${eid}/confirmar`).set(auth(t));
    await request(app).put(`/api/clientes/${cid}`).set(auth(t)).send(datosCliente({ nombre: 'Editado' }));
    await request(app).delete(`/api/clientes/${cid}?confirmar=true`).set(auth(t));
    const r = await request(app).get(`/api/productoras/${pid}/auditoria`).set(auth(t));
    const acciones = r.body.datos.map((a) => `${a.accion}:${a.objeto}`);
    expect(acciones).toEqual(expect.arrayContaining(['crear:cliente', 'editar:cliente', 'eliminar:cliente', 'crear:evento', 'subir:contrato', 'confirmar:evento']));
  });
  test('CP-26 coordinador no puede leer la auditoria', async () => {
    const tA = await registrar('admin1'); const pid = await productora(tA);
    await registrar('coord1');
    await request(app).post(`/api/productoras/${pid}/usuarios`).set(auth(tA)).send({ usuario: 'coord1', rol: 'coordinador' });
    const tC = (await request(app).post('/api/auth/login').send({ usuario: 'coord1', password: PW })).body.token;
    const r = await request(app).get(`/api/productoras/${pid}/auditoria`).set(auth(tC));
    expect(r.status).toBe(403);
  });
});

describe('Pruebas complementarias', () => {
  test('CP-27 NFR-SEG-6 la auditoria no almacena contrasenas ni hashes', async () => {
    const t = await registrar('ana'); const pid = await productora(t); await cliente(t, pid);
    const filas = JSON.stringify(db.prepare('SELECT * FROM auditoria').all());
    expect(filas).not.toContain(PW);
    expect(filas).not.toMatch(/\$2[aby]\$/);
  });
  test('CP-28 NFR-USAB-4 flujo cliente -> eventos con estado calculado', async () => {
    const { t, cid } = await conEvento({ fecha_evento: '2030-01-01' });
    const r = await request(app).get(`/api/clientes/${cid}/eventos`).set(auth(t));
    expect(r.body.datos).toHaveLength(1);
    expect(r.body.datos[0].estado).toBe('cotizado');
  });
  test('CP-30 RF-4.1 cliente sin campos opcionales (como envia el formulario)', async () => {
    const t = await registrar('ana'); const pid = await productora(t);
    const r = await request(app).post(`/api/productoras/${pid}/clientes`).set(auth(t)).send(datosCliente({ nombre: 'Solo Nombre', descripcion: '', direccion: '', contacto: '' }));
    expect(r.status).toBe(201);
  });
  test('CP-29 RF-5.2 subida de un PDF de 5 MB en menos de 10 segundos', async () => {
    const { t, eid } = await conEvento();
    const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 - PDF.length, 'a')]);
    const ini = Date.now();
    const r = await adjuntar(t, eid, 'contrato', grande, 'grande.pdf');
    const ms = Date.now() - ini;
    console.log('CP-29 tiempo de subida (ms):', ms);
    expect(r.status).toBe(201);
    expect(ms).toBeLessThan(10000);
  });
});
