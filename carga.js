const autocannon = require('autocannon');
const base = 'http://localhost:3200';
const PW = 'Clave-Segura-2026!';
const j = async (p, body, tok) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) })).json();
(async () => {
  await j('/api/auth/register', { usuario: 'carga', password: PW, correo: 'c@x.cl' });
  const { token } = await j('/api/auth/login', { usuario: 'carga', password: PW });
  const e = await j('/api/productoras', { nombre: 'Carga Producciones', direccion: 'Calle 1', telefono: '22123456', correo: 'carga@x.cl' }, token);
  for (let i = 0; i < 30; i++) await j(`/api/productoras/${e.id}/clientes`, { tipo: 'empresa', rut: '76.086.428-5', nombre: `Cliente ${i}` }, token);
  const r = await autocannon({ url: `${base}/api/productoras/${e.id}/clientes?pagina=1&tam=10`, connections: Number(process.argv[2]), duration: 15, headers: { authorization: `Bearer ${token}` } });
  console.log(JSON.stringify({ conexiones: r.connections, duracion_s: r.duration, req_total: r.requests.total, req_seg: r.requests.average, lat_prom_ms: r.latency.average, lat_p50_ms: r.latency.p50, lat_p97_5_ms: r.latency.p97_5, lat_p99_ms: r.latency.p99, lat_max_ms: r.latency.max, errores: r.errors, non2xx: r.non2xx, timeouts: r.timeouts }, null, 2));
})();
