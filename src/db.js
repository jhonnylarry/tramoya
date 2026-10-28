const { DatabaseSync } = require('node:sqlite');

function crearDb(ruta = ':memory:') {
  const db = new DatabaseSync(ruta);
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      correo TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS productoras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      direccion TEXT, telefono TEXT, correo TEXT
    );
    CREATE TABLE IF NOT EXISTS productora_usuarios (
      productora_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('administrador','coordinador')),
      PRIMARY KEY (productora_id, usuario_id)
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productora_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('persona','empresa')),
      rut TEXT NOT NULL,
      nombre TEXT NOT NULL, descripcion TEXT, direccion TEXT, contacto TEXT,
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      titulo TEXT NOT NULL, descripcion TEXT,
      fecha_evento TEXT NOT NULL,
      recinto TEXT NOT NULL,
      aforo INTEGER NOT NULL,
      monto INTEGER NOT NULL CHECK (monto > 0),
      confirmado INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('cotizacion','contrato')),
      nombre_original TEXT, ruta TEXT NOT NULL,
      UNIQUE (evento_id, tipo)
    );
    CREATE TABLE IF NOT EXISTS enlaces (
      token TEXT PRIMARY KEY,
      documento_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productora_id INTEGER, usuario_id INTEGER,
      accion TEXT NOT NULL, objeto TEXT, objeto_id INTEGER,
      fecha TEXT NOT NULL
    );
  `);
  return db;
}

module.exports = { crearDb };
