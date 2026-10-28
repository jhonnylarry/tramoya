// Respaldo y recuperación de Tramoya (NFR-SEG-7). Uso:
//   node scripts/respaldo.js respaldar <db> <storage> <destino>
//   node scripts/respaldo.js restaurar <respaldo> <db> <storage>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function sha(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }

function respaldar(dbRuta, storageDir, destino) {
  fs.mkdirSync(path.join(destino, 'storage'), { recursive: true });
  const db = new DatabaseSync(dbRuta);
  const copia = path.join(destino, 'tramoya.db');
  if (fs.existsSync(copia)) fs.unlinkSync(copia);
  db.exec(`VACUUM INTO '${copia.replace(/'/g, "''")}'`); // copia consistente con el servidor en uso
  db.close();
  const manifiesto = { fecha: new Date().toISOString(), archivos: {} };
  manifiesto.archivos['tramoya.db'] = sha(copia);
  for (const f of fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : []) {
    fs.copyFileSync(path.join(storageDir, f), path.join(destino, 'storage', f));
    manifiesto.archivos['storage/' + f] = sha(path.join(destino, 'storage', f));
  }
  fs.writeFileSync(path.join(destino, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  return manifiesto;
}

function restaurar(respaldo, dbRuta, storageDir) {
  const m = JSON.parse(fs.readFileSync(path.join(respaldo, 'manifiesto.json'), 'utf8'));
  for (const [rel, hash] of Object.entries(m.archivos)) { // verifica integridad antes de tocar el destino
    if (sha(path.join(respaldo, rel)) !== hash) throw new Error('Respaldo corrupto: ' + rel);
  }
  fs.mkdirSync(storageDir, { recursive: true });
  fs.copyFileSync(path.join(respaldo, 'tramoya.db'), dbRuta);
  for (const rel of Object.keys(m.archivos).filter((r) => r.startsWith('storage/'))) {
    fs.copyFileSync(path.join(respaldo, rel), path.join(storageDir, path.basename(rel)));
  }
  return m;
}

module.exports = { respaldar, restaurar };
if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  const r = cmd === 'respaldar' ? respaldar(a, b, c) : restaurar(a, b, c);
  console.log(cmd + ' OK', Object.keys(r.archivos).length + ' archivos');
}
