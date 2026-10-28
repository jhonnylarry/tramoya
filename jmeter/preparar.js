// Prepara datos para JMeter: usuario, productora, 30 clientes y un evento. Imprime token, productora y cliente.
const base = process.argv[2] || 'http://localhost:3200';
const PW = 'Clave-Segura-2026!';
const j = async (p, body, tok) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) })).json();
(async () => {
  await j('/api/auth/register', { usuario: 'jmeter', password: PW, correo: 'jmeter@x.cl' });
  const { token } = await j('/api/auth/login', { usuario: 'jmeter', password: PW });
  const p = await j('/api/productoras', { nombre: 'Producciones Carga', direccion: 'Calle 1', telefono: '221234567', correo: 'jmeter@prod.cl' }, token);
  let cid;
  for (let i = 0; i < 30; i++) cid = (await j(`/api/productoras/${p.id}/clientes`, { tipo: 'empresa', rut: '76.086.428-5', nombre: `Cliente ${i}` }, token)).id;
  await j('/api/eventos', { cliente_id: cid, titulo: 'Feria', fecha_evento: '2027-03-01', recinto: 'Estacion Mapocho', aforo: 1500, monto: 9000000 }, token);
  console.log(`-Jtoken=${token} -Jpid=${p.id} -Jcid=${cid}`);
})();
