const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { crearDb } = require('./db');
const v = require('./validacion');
const { calcularEstado } = require('./eventos');

const TIPOS_DOC = ['cotizacion', 'contrato'];
const ROLES = ['administrador', 'coordinador'];

function crearApp({ dbRuta = ':memory:', storageDir = path.join(__dirname, '..', 'storage') } = {}) {
  const db = crearDb(dbRuta);
  const SECRET = process.env.JWT_SECRET || 'tramoya-dev-secret';
  const revocados = new Set();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  fs.mkdirSync(storageDir, { recursive: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  const audit = (productoraId, usuarioId, accion, objeto, objetoId) =>
    db.prepare('INSERT INTO auditoria (productora_id, usuario_id, accion, objeto, objeto_id, fecha) VALUES (?,?,?,?,?,?)')
      .run(productoraId ?? null, usuarioId ?? null, accion, objeto, objetoId ?? null, new Date().toISOString());

  // ---------- middlewares ----------
  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      const p = jwt.verify(token, SECRET);
      if (revocados.has(p.jti)) return res.status(401).json({ error: 'Sesion revocada' });
      req.user = p;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Token invalido o expirado' });
    }
  }

  // RB-2: solo usuarios con relacion en productora_usuarios. Devuelve rol o null
  function rolEn(productoraId, usuarioId) {
    const r = db.prepare('SELECT rol FROM productora_usuarios WHERE productora_id=? AND usuario_id=?').get(productoraId, usuarioId);
    return r ? r.rol : null;
  }
  const exigirMiembro = (req, res, next) => {
    const pid = Number(req.params.productoraId);
    const rol = rolEn(pid, req.user.sub);
    if (!rol) return res.status(403).json({ error: 'Sin acceso a la productora' });
    req.productoraId = pid; req.rol = rol;
    next();
  };
  const exigirAdmin = (req, res, next) => {
    if (req.rol !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    next();
  };

  // ---------- RF-1 / RF-2 ----------
  app.post('/api/auth/register', (req, res) => {
    const { usuario, password, correo } = req.body || {};
    if (!v.texto(usuario, 40) || !/^[A-Za-z0-9_.-]+$/.test(usuario)) return res.status(400).json({ error: 'Usuario invalido' });
    if (!v.validarCorreo(correo)) return res.status(400).json({ error: 'Correo invalido' });
    if (!v.validarPassword(password)) return res.status(400).json({ error: 'La contrasena no cumple la politica' });
    if (db.prepare('SELECT 1 FROM usuarios WHERE usuario=?').get(usuario)) return res.status(409).json({ error: 'Usuario ya existe' });
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO usuarios (usuario, correo, password_hash) VALUES (?,?,?)').run(usuario, correo, hash);
    audit(null, r.lastInsertRowid, 'registro', 'usuario', r.lastInsertRowid);
    res.status(201).json({ id: Number(r.lastInsertRowid), usuario });
  });

  app.post('/api/auth/login', (req, res) => {
    const { usuario, password } = req.body || {};
    const u = typeof usuario === 'string' ? db.prepare('SELECT * FROM usuarios WHERE usuario=?').get(usuario) : null;
    if (!u || typeof password !== 'string' || !bcrypt.compareSync(password, u.password_hash)) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const token = jwt.sign({ sub: u.id, usuario: u.usuario }, SECRET, { expiresIn: '15m', jwtid: crypto.randomUUID() });
    audit(null, u.id, 'login', 'usuario', u.id);
    res.json({ token });
  });

  app.post('/api/auth/logout', auth, (req, res) => {
    revocados.add(req.user.jti);
    audit(null, req.user.sub, 'logout', 'usuario', req.user.sub);
    res.json({ ok: true });
  });

  app.post('/api/productoras', auth, (req, res) => {
    const { nombre, direccion, telefono, correo } = req.body || {};
    if (!v.texto(nombre, 80) || !v.texto(direccion, 120) || !v.texto(telefono, 20) || !v.validarCorreo(correo)) {
      return res.status(400).json({ error: 'Datos de productora invalidos' });
    }
    // RB-1: correo principal unico entre productoras
    if (db.prepare('SELECT 1 FROM productoras WHERE correo=?').get(correo)) return res.status(409).json({ error: 'Correo ya asociado a otra productora' });
    const e = db.prepare('INSERT INTO productoras (nombre, direccion, telefono, correo) VALUES (?,?,?,?)')
      .run(v.sanear(nombre), v.sanear(direccion), telefono, correo);
    // RF-2.3: primer usuario = administrador
    db.prepare('INSERT INTO productora_usuarios (productora_id, usuario_id, rol) VALUES (?,?,?)').run(e.lastInsertRowid, req.user.sub, 'administrador');
    audit(e.lastInsertRowid, req.user.sub, 'crear', 'productora', e.lastInsertRowid);
    res.status(201).json({ id: Number(e.lastInsertRowid), rol: 'administrador' });
  });

  // Productoras a las que pertenece el usuario autenticado (para el frontend)
  app.get('/api/productoras', auth, (req, res) => {
    const filas = db.prepare('SELECT p.id, p.nombre, pu.rol FROM productoras p JOIN productora_usuarios pu ON pu.productora_id=p.id WHERE pu.usuario_id=?').all(req.user.sub);
    res.json({ datos: filas });
  });

  app.get('/api/productoras/:productoraId/usuarios', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const filas = db.prepare('SELECT u.id, u.usuario, pu.rol FROM productora_usuarios pu JOIN usuarios u ON u.id=pu.usuario_id WHERE pu.productora_id=?').all(req.productoraId);
    res.json({ datos: filas });
  });

  // ---------- RF-3 equipo de la productora ----------
  app.post('/api/productoras/:productoraId/usuarios', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const { usuario, rol } = req.body || {};
    if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol invalido' });
    const u = db.prepare('SELECT id FROM usuarios WHERE usuario=?').get(String(usuario));
    if (!u) return res.status(404).json({ error: 'Usuario no existe' });
    db.prepare('INSERT OR REPLACE INTO productora_usuarios (productora_id, usuario_id, rol) VALUES (?,?,?)').run(req.productoraId, u.id, rol);
    audit(req.productoraId, req.user.sub, 'crear', 'usuario_productora', u.id);
    res.status(201).json({ usuario_id: u.id, rol });
  });

  app.put('/api/productoras/:productoraId/usuarios/:uid', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const { rol } = req.body || {};
    if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol invalido' });
    const r = db.prepare('UPDATE productora_usuarios SET rol=? WHERE productora_id=? AND usuario_id=?').run(rol, req.productoraId, Number(req.params.uid));
    if (!r.changes) return res.status(404).json({ error: 'No encontrado' });
    audit(req.productoraId, req.user.sub, 'editar', 'usuario_productora', Number(req.params.uid));
    res.json({ ok: true });
  });

  app.delete('/api/productoras/:productoraId/usuarios/:uid', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const r = db.prepare('DELETE FROM productora_usuarios WHERE productora_id=? AND usuario_id=?').run(req.productoraId, Number(req.params.uid));
    if (!r.changes) return res.status(404).json({ error: 'No encontrado' });
    audit(req.productoraId, req.user.sub, 'eliminar', 'usuario_productora', Number(req.params.uid));
    res.json({ ok: true });
  });

  // ---------- RF-4 clientes organizadores ----------
  function datosCliente(b) {
    if (!v.validarNombreCliente(b.nombre)) return null;
    if (!['persona', 'empresa'].includes(b.tipo)) return null;
    if (!v.validarRut(b.rut)) return null;
    for (const k of ['descripcion', 'direccion', 'contacto']) {
      if (b[k] !== undefined && b[k] !== '' && !v.texto(String(b[k]), 200)) return null; // campos opcionales pueden venir vacios
    }
    return {
      nombre: b.nombre, tipo: b.tipo, rut: b.rut.replace(/\./g, '').toUpperCase(),
      descripcion: v.sanear(b.descripcion || ''), direccion: v.sanear(b.direccion || ''), contacto: v.sanear(b.contacto || ''),
    };
  }

  app.post('/api/productoras/:productoraId/clientes', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const d = datosCliente(req.body || {});
    if (!d) return res.status(400).json({ error: 'Datos de cliente invalidos' });
    const r = db.prepare('INSERT INTO clientes (productora_id, tipo, rut, nombre, descripcion, direccion, contacto) VALUES (?,?,?,?,?,?,?)')
      .run(req.productoraId, d.tipo, d.rut, d.nombre, d.descripcion, d.direccion, d.contacto);
    audit(req.productoraId, req.user.sub, 'crear', 'cliente', r.lastInsertRowid);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  app.get('/api/productoras/:productoraId/clientes', auth, exigirMiembro, (req, res) => {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const tam = Math.min(50, Math.max(1, parseInt(req.query.tam, 10) || 10));
    const filtro = `%${String(req.query.nombre || '')}%`;
    const filas = db.prepare('SELECT id, tipo, rut, nombre, descripcion, direccion, contacto FROM clientes WHERE productora_id=? AND activo=1 AND nombre LIKE ? ORDER BY id LIMIT ? OFFSET ?')
      .all(req.productoraId, filtro, tam, (pagina - 1) * tam);
    res.json({ pagina, tam, datos: filas });
  });

  function clienteDe(id) { return db.prepare('SELECT * FROM clientes WHERE id=? AND activo=1').get(Number(id)); }

  app.put('/api/clientes/:id', auth, (req, res) => {
    const c = clienteDe(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    if (rolEn(c.productora_id, req.user.sub) !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    const d = datosCliente(req.body || {});
    if (!d) return res.status(400).json({ error: 'Datos de cliente invalidos' });
    db.prepare('UPDATE clientes SET tipo=?, rut=?, nombre=?, descripcion=?, direccion=?, contacto=? WHERE id=?').run(d.tipo, d.rut, d.nombre, d.descripcion, d.direccion, d.contacto, c.id);
    audit(c.productora_id, req.user.sub, 'editar', 'cliente', c.id);
    res.json({ ok: true });
  });

  // Eliminacion logica con confirmacion explicita (criterio RF-4.2)
  app.delete('/api/clientes/:id', auth, (req, res) => {
    const c = clienteDe(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    if (rolEn(c.productora_id, req.user.sub) !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    if (req.query.confirmar !== 'true') return res.status(400).json({ error: 'Se requiere confirmacion' });
    db.prepare('UPDATE clientes SET activo=0 WHERE id=?').run(c.id);
    audit(c.productora_id, req.user.sub, 'eliminar', 'cliente', c.id);
    res.json({ ok: true });
  });

  // ---------- RF-5 eventos, cotizacion y contrato ----------
  function eventoConAcceso(id, userId) {
    const k = db.prepare('SELECT ev.*, cl.productora_id FROM eventos ev JOIN clientes cl ON cl.id=ev.cliente_id WHERE ev.id=?').get(Number(id));
    if (!k) return { error: 404 };
    const rol = rolEn(k.productora_id, userId);
    if (!rol) return { error: 403 };
    return { k, rol };
  }

  app.post('/api/eventos', auth, (req, res) => {
    const { cliente_id, titulo, descripcion, fecha_evento, recinto, aforo, monto } = req.body || {};
    const c = clienteDe(cliente_id);
    if (!c) return res.status(404).json({ error: 'Cliente no existe' });
    if (rolEn(c.productora_id, req.user.sub) !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    if (!v.texto(titulo, 100) || !v.validarFecha(fecha_evento) || !v.texto(recinto, 120) || !v.validarAforo(aforo)) {
      return res.status(400).json({ error: 'Datos de evento invalidos' });
    }
    if (!v.validarMonto(monto)) return res.status(400).json({ error: 'Monto invalido' });
    const r = db.prepare('INSERT INTO eventos (cliente_id, titulo, descripcion, fecha_evento, recinto, aforo, monto) VALUES (?,?,?,?,?,?,?)')
      .run(c.id, v.sanear(titulo), v.sanear(descripcion || ''), fecha_evento, v.sanear(recinto.trim()), aforo, monto);
    audit(c.productora_id, req.user.sub, 'crear', 'evento', r.lastInsertRowid);
    res.status(201).json({ id: Number(r.lastInsertRowid), estado: 'cotizado' });
  });

  // NFR-USAB-4: primero clientes, luego sus eventos
  app.get('/api/clientes/:id/eventos', auth, (req, res) => {
    const c = clienteDe(req.params.id);
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    if (!rolEn(c.productora_id, req.user.sub)) return res.status(403).json({ error: 'Sin acceso' });
    const docs = db.prepare('SELECT id, tipo FROM documentos WHERE evento_id=?');
    const filas = db.prepare('SELECT * FROM eventos WHERE cliente_id=? ORDER BY fecha_evento').all(c.id)
      .map((k) => {
        const d = Object.fromEntries(docs.all(k.id).map((x) => [x.tipo, x.id]));
        return { ...k, confirmado: !!k.confirmado, estado: calcularEstado(k.fecha_evento, k.confirmado), documentos: d };
      });
    res.json({ datos: filas });
  });

  // RF-5.2: cotizacion y contrato del evento, solo en PDF, uno de cada tipo
  app.post('/api/eventos/:id/documentos', auth, upload.single('archivo'), (req, res) => {
    const { k, rol, error } = eventoConAcceso(req.params.id, req.user.sub);
    if (error) return res.status(error).json({ error: 'Evento no accesible' });
    if (rol !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    const tipo = (req.body || {}).tipo;
    if (!TIPOS_DOC.includes(tipo)) return res.status(400).json({ error: 'Tipo de documento invalido' });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.pdf' || req.file.buffer.subarray(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'Formato no permitido' });
    if (db.prepare('SELECT 1 FROM documentos WHERE evento_id=? AND tipo=?').get(k.id, tipo)) return res.status(409).json({ error: 'El evento ya tiene ese documento' });
    const nombreInterno = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(storageDir, nombreInterno), req.file.buffer);
    const r = db.prepare('INSERT INTO documentos (evento_id, tipo, nombre_original, ruta) VALUES (?,?,?,?)').run(k.id, tipo, v.sanear(req.file.originalname), nombreInterno);
    audit(k.productora_id, req.user.sub, 'subir', tipo, r.lastInsertRowid);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  // RF-5.4: confirmar evento (RB-6 recinto libre, RB-7 contrato adjunto)
  app.post('/api/eventos/:id/confirmar', auth, (req, res) => {
    const { k, rol, error } = eventoConAcceso(req.params.id, req.user.sub);
    if (error) return res.status(error).json({ error: 'Evento no accesible' });
    if (rol !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    if (k.confirmado) return res.status(409).json({ error: 'El evento ya esta confirmado' });
    if (!db.prepare("SELECT 1 FROM documentos WHERE evento_id=? AND tipo='contrato'").get(k.id)) {
      return res.status(409).json({ error: 'El evento no tiene contrato adjunto' });
    }
    const choque = db.prepare(`SELECT ev.id FROM eventos ev JOIN clientes cl ON cl.id=ev.cliente_id
      WHERE cl.productora_id=? AND ev.confirmado=1 AND ev.fecha_evento=? AND lower(ev.recinto)=lower(?) AND ev.id<>?`)
      .get(k.productora_id, k.fecha_evento, k.recinto, k.id);
    if (choque) return res.status(409).json({ error: 'Recinto ocupado en esa fecha' });
    db.prepare('UPDATE eventos SET confirmado=1 WHERE id=?').run(k.id);
    audit(k.productora_id, req.user.sub, 'confirmar', 'evento', k.id);
    res.json({ ok: true, estado: calcularEstado(k.fecha_evento, true) });
  });

  app.get('/api/documentos/:id', auth, (req, res) => {
    const d = db.prepare('SELECT * FROM documentos WHERE id=?').get(Number(req.params.id));
    if (!d) return res.status(404).json({ error: 'No encontrado' });
    const { k, error } = eventoConAcceso(d.evento_id, req.user.sub);
    if (error) return res.status(error).json({ error: 'Sin acceso' });
    audit(k.productora_id, req.user.sub, 'descargar', d.tipo, d.id);
    res.download(path.join(storageDir, d.ruta), d.nombre_original);
  });

  // RF-5.5: enlace de cotizacion para el cliente
  app.post('/api/eventos/:id/compartir', auth, (req, res) => {
    const { k, rol, error } = eventoConAcceso(req.params.id, req.user.sub);
    if (error) return res.status(error).json({ error: 'Evento no accesible' });
    if (rol !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
    const d = db.prepare("SELECT id FROM documentos WHERE evento_id=? AND tipo='cotizacion'").get(k.id);
    if (!d) return res.status(404).json({ error: 'Evento sin cotizacion' });
    const token = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO enlaces (token, documento_id) VALUES (?,?)').run(token, d.id);
    audit(k.productora_id, req.user.sub, 'compartir', 'cotizacion', d.id);
    res.status(201).json({ url: `/api/cotizacion/${token}` });
  });

  app.get('/api/cotizacion/:token', (req, res) => {
    const e = db.prepare('SELECT documento_id FROM enlaces WHERE token=?').get(String(req.params.token));
    if (!e) return res.status(404).json({ error: 'Enlace invalido' });
    const d = db.prepare('SELECT * FROM documentos WHERE id=?').get(e.documento_id);
    res.download(path.join(storageDir, d.ruta), d.nombre_original);
  });

  // ---------- RF-6 auditoria ----------
  app.get('/api/productoras/:productoraId/auditoria', auth, exigirMiembro, exigirAdmin, (req, res) => {
    const filas = db.prepare('SELECT * FROM auditoria WHERE productora_id=? ORDER BY id DESC LIMIT 200').all(req.productoraId);
    res.json({ datos: filas });
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Archivo invalido' });
    res.status(500).json({ error: 'Error interno' });
  });

  return { app, db };
}

module.exports = { crearApp };
