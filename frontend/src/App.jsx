import React, { useEffect, useState } from 'react';

// ---------- acceso a la API ----------
let token = null;
async function api(ruta, { metodo = 'GET', cuerpo, form } = {}) {
  const cab = {};
  if (token) cab.Authorization = `Bearer ${token}`;
  if (cuerpo) cab['Content-Type'] = 'application/json';
  const r = await fetch(ruta, { method: metodo, headers: cab, body: form || (cuerpo ? JSON.stringify(cuerpo) : undefined) });
  const tipo = r.headers.get('content-type') || '';
  const datos = tipo.includes('json') ? await r.json() : null;
  if (!r.ok) throw new Error((datos && datos.error) || 'No se pudo completar la operación');
  return datos;
}

const MENSAJES = {
  'Credenciales invalidas': 'Usuario o contraseña incorrectos.',
  'La contrasena no cumple la politica': 'La contraseña debe tener al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.',
  'Usuario ya existe': 'Ese nombre de usuario ya está en uso.',
  'Correo invalido': 'Ingrese un correo válido, por ejemplo nombre@empresa.cl.',
  'Usuario invalido': 'El usuario solo puede tener letras, números, punto, guion y guion bajo.',
  'Correo ya asociado a otra productora': 'Ese correo ya está asociado a otra productora.',
  'Datos de cliente invalidos': 'Revise los datos del cliente: el nombre solo admite letras, números y signos básicos, y el RUT debe tener un dígito verificador válido (por ejemplo 12.345.678-5).',
  'Datos de evento invalidos': 'Revise los datos del evento: fecha, recinto y aforo (número entero mayor que cero) son obligatorios.',
  'Monto invalido': 'El monto debe ser un número entero de pesos mayor que cero, sin puntos ni decimales.',
  'Formato no permitido': 'Formato no permitido. Solo se aceptan archivos PDF.',
  'El evento ya tiene ese documento': 'Este evento ya tiene ese documento adjunto.',
  'El evento no tiene contrato adjunto': 'Para confirmar el evento primero adjunte el contrato en PDF.',
  'Recinto ocupado en esa fecha': 'Ya hay otro evento confirmado en ese recinto y esa fecha.',
  'Evento sin cotizacion': 'Adjunte primero la cotización en PDF para generar el enlace.',
  'Solo administradores': 'Esta acción es solo para administradores.',
};
const amable = (e) => MENSAJES[e.message] || e.message;

function Mensaje({ error, ok }) {
  return (
    <div aria-live="polite">
      {error && <p role="alert" className="error">{error}</p>}
      {ok && <p className="ok">{ok}</p>}
    </div>
  );
}

function Campo({ id, etiqueta, ayuda, ...resto }) {
  return (
    <label htmlFor={id}>
      {etiqueta}
      <input id={id} aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...resto} />
      {ayuda && <span id={`${id}-ayuda`} className="ayuda">{ayuda}</span>}
    </label>
  );
}

// ---------- acceso: login y registro (RF-1, RF-2.1) ----------
function Acceso({ onEntrar }) {
  const [modo, setModo] = useState('login');
  const [f, setF] = useState({ usuario: '', password: '', correo: '' });
  const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault(); setError(''); setOk('');
    try {
      if (modo === 'registro') {
        await api('/api/auth/register', { metodo: 'POST', cuerpo: f });
        setOk('Cuenta creada. Ahora puede iniciar sesión.'); setModo('login'); return;
      }
      const r = await api('/api/auth/login', { metodo: 'POST', cuerpo: { usuario: f.usuario, password: f.password } });
      token = r.token; onEntrar(f.usuario);
    } catch (err) { setError(amable(err)); }
  }

  return (
    <main id="contenido">
      <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear una cuenta'}</h2>
      <form onSubmit={enviar} aria-label={modo === 'login' ? 'Formulario de inicio de sesión' : 'Formulario de registro'}>
        <Campo id="usuario" etiqueta="Usuario" value={f.usuario} onChange={cambiar('usuario')} required autoComplete="username" />
        {modo === 'registro' && <Campo id="correo" etiqueta="Correo electrónico" type="email" value={f.correo} onChange={cambiar('correo')} required autoComplete="email" />}
        <Campo id="password" etiqueta="Contraseña" type="password" value={f.password} onChange={cambiar('password')} required autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          ayuda={modo === 'registro' ? 'Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.' : undefined} />
        <Mensaje error={error} ok={ok} />
        <button type="submit">{modo === 'login' ? 'Entrar' : 'Registrarme'}</button>
      </form>
      <button type="button" className="sec" onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); }}>
        {modo === 'login' ? 'No tengo cuenta: registrarme' : 'Ya tengo cuenta: iniciar sesión'}
      </button>
    </main>
  );
}

// ---------- crear productora (RF-2.2 / RF-2.3) ----------
function CrearProductora({ onCreada }) {
  const [f, setF] = useState({ nombre: '', direccion: '', telefono: '', correo: '' });
  const [error, setError] = useState('');
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function enviar(e) {
    e.preventDefault(); setError('');
    try { await api('/api/productoras', { metodo: 'POST', cuerpo: f }); onCreada(); } catch (err) { setError(amable(err)); }
  }
  return (
    <main id="contenido">
      <h2>Cree su productora</h2>
      <p>Para comenzar, registre los datos de su productora. Usted quedará como administrador.</p>
      <form onSubmit={enviar} aria-label="Formulario de creación de productora">
        <Campo id="e-nombre" etiqueta="Nombre de la productora" value={f.nombre} onChange={cambiar('nombre')} required />
        <Campo id="e-dir" etiqueta="Dirección" value={f.direccion} onChange={cambiar('direccion')} required />
        <Campo id="e-tel" etiqueta="Teléfono" type="tel" value={f.telefono} onChange={cambiar('telefono')} required />
        <Campo id="e-correo" etiqueta="Correo de la productora" type="email" value={f.correo} onChange={cambiar('correo')} required />
        <Mensaje error={error} />
        <button type="submit">Crear productora</button>
      </form>
    </main>
  );
}

// ---------- clientes organizadores (RF-4) ----------
const VACIO_CLIENTE = { tipo: 'empresa', rut: '', nombre: '', descripcion: '', direccion: '', contacto: '' };

function Clientes({ productora, esAdmin, onVerEventos }) {
  const [datos, setDatos] = useState([]); const [pagina, setPagina] = useState(1); const [filtro, setFiltro] = useState('');
  const [f, setF] = useState(VACIO_CLIENTE);
  const [edit, setEdit] = useState(null); const [borrar, setBorrar] = useState(null);
  const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const TAM = 5;

  async function cargar() {
    try { const r = await api(`/api/productoras/${productora.id}/clientes?pagina=${pagina}&tam=${TAM}&nombre=${encodeURIComponent(filtro)}`); setDatos(r.datos); }
    catch (e) { setError(amable(e)); }
  }
  useEffect(() => { cargar(); }, [pagina, filtro, productora.id]); // eslint-disable-line

  async function guardar(e) {
    e.preventDefault(); setError(''); setOk('');
    try {
      if (edit) await api(`/api/clientes/${edit}`, { metodo: 'PUT', cuerpo: f });
      else await api(`/api/productoras/${productora.id}/clientes`, { metodo: 'POST', cuerpo: f });
      setOk(edit ? 'Cliente actualizado.' : 'Cliente creado.'); setEdit(null); setF(VACIO_CLIENTE); cargar();
    } catch (err) { setError(amable(err)); }
  }
  async function eliminar(id) {
    try { await api(`/api/clientes/${id}?confirmar=true`, { metodo: 'DELETE' }); setBorrar(null); setOk('Cliente eliminado.'); cargar(); }
    catch (err) { setError(amable(err)); }
  }

  return (
    <main id="contenido">
      <h2>Clientes</h2>
      <Mensaje error={error} ok={ok} />
      <div className="fila">
        <label htmlFor="filtro">Buscar por nombre</label>
        <input id="filtro" value={filtro} onChange={(e) => { setPagina(1); setFiltro(e.target.value); }} />
      </div>
      <div className="tabla-scroll">
        <table>
          <caption className="ayuda">Clientes de {productora.nombre}, página {pagina}</caption>
          <thead><tr><th scope="col">Nombre</th><th scope="col">RUT</th><th scope="col">Tipo</th><th scope="col">Contacto</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            {datos.length === 0 && <tr><td colSpan="5">No hay clientes para mostrar.</td></tr>}
            {datos.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td><td>{c.rut}</td><td>{c.tipo}</td><td>{c.contacto}</td>
                <td>
                  <div className="fila">
                    <button className="sec" onClick={() => onVerEventos(c)}>Ver eventos de {c.nombre}</button>
                    {esAdmin && <button className="sec" onClick={() => { setEdit(c.id); setF({ tipo: c.tipo, rut: c.rut, nombre: c.nombre, descripcion: c.descripcion || '', direccion: c.direccion || '', contacto: c.contacto || '' }); }}>Editar</button>}
                    {esAdmin && <button className="peligro" onClick={() => setBorrar(c.id)}>Eliminar</button>}
                  </div>
                  {borrar === c.id && (
                    <div role="group" aria-label="Confirmar eliminación" className="tarjeta">
                      <p>¿Seguro que desea eliminar a {c.nombre}?</p>
                      <div className="fila"><button className="peligro" onClick={() => eliminar(c.id)}>Sí, eliminar</button><button className="sec" onClick={() => setBorrar(null)}>Cancelar</button></div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fila" style={{ margin: '.75rem 0' }}>
        <button className="sec" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Página anterior</button>
        <span>Página {pagina}</span>
        <button className="sec" disabled={datos.length < TAM} onClick={() => setPagina(pagina + 1)}>Página siguiente</button>
      </div>
      {esAdmin ? (
        <form onSubmit={guardar} aria-label={edit ? 'Editar cliente' : 'Nuevo cliente'}>
          <h3>{edit ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <label htmlFor="c-tipo">Tipo de cliente
            <select id="c-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="empresa">Empresa</option><option value="persona">Persona</option>
            </select>
          </label>
          <Campo id="c-rut" etiqueta="RUT" value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} required ayuda="Con guion y dígito verificador, por ejemplo 12.345.678-5." />
          <Campo id="c-nombre" etiqueta="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
          <Campo id="c-desc" etiqueta="Descripción" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          <Campo id="c-dir" etiqueta="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
          <Campo id="c-con" etiqueta="Información de contacto" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
          <div className="fila"><button type="submit">{edit ? 'Guardar cambios' : 'Crear cliente'}</button>{edit && <button type="button" className="sec" onClick={() => { setEdit(null); setF(VACIO_CLIENTE); }}>Cancelar edición</button>}</div>
        </form>
      ) : <p className="ayuda">Su rol es coordinador: puede ver los datos, pero no modificarlos.</p>}
    </main>
  );
}

// ---------- eventos, cotización y contrato (RF-5) ----------
const VACIO_EVENTO = { titulo: '', descripcion: '', fecha_evento: '', recinto: '', aforo: '', monto: '' };
const ESTADOS = { cotizado: 'Cotizado', confirmado: 'Confirmado', proximo: 'Próximo', realizado: 'Realizado' };
const pesos = (n) => `$${Number(n).toLocaleString('es-CL')}`;

function Eventos({ cliente, esAdmin, volver }) {
  const [datos, setDatos] = useState([]); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [enlace, setEnlace] = useState('');
  const [f, setF] = useState(VACIO_EVENTO);
  const cargar = async () => { try { setDatos((await api(`/api/clientes/${cliente.id}/eventos`)).datos); } catch (e) { setError(amable(e)); } };
  useEffect(() => { cargar(); }, [cliente.id]); // eslint-disable-line

  async function crear(e) {
    e.preventDefault(); setError(''); setOk('');
    const cuerpo = { ...f, cliente_id: cliente.id, aforo: Number(f.aforo), monto: Number(f.monto) };
    try { await api('/api/eventos', { metodo: 'POST', cuerpo }); setOk('Evento creado como cotizado.'); setF(VACIO_EVENTO); cargar(); }
    catch (err) { setError(amable(err)); }
  }
  async function subir(id, tipo, archivo) {
    if (!archivo) return; setError(''); setOk('');
    const fd = new FormData(); fd.append('tipo', tipo); fd.append('archivo', archivo);
    try { await api(`/api/eventos/${id}/documentos`, { metodo: 'POST', form: fd }); setOk(tipo === 'contrato' ? 'Contrato adjuntado.' : 'Cotización adjuntada.'); cargar(); }
    catch (err) { setError(amable(err)); }
  }
  async function confirmar(id) {
    setError(''); setOk('');
    try { await api(`/api/eventos/${id}/confirmar`, { metodo: 'POST' }); setOk('Evento confirmado.'); cargar(); }
    catch (err) { setError(amable(err)); }
  }
  async function descargar(docId) {
    const r = await fetch(`/api/documentos/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { setError('No se pudo descargar el documento.'); return; }
    const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = 'documento.pdf'; a.click(); URL.revokeObjectURL(url);
  }
  async function compartir(id) {
    setError(''); try { const r = await api(`/api/eventos/${id}/compartir`, { metodo: 'POST' }); setEnlace(window.location.origin + r.url); } catch (err) { setError(amable(err)); }
  }

  return (
    <main id="contenido">
      <button className="sec" onClick={volver}>Volver a clientes</button>
      <h2>Eventos de {cliente.nombre}</h2>
      <Mensaje error={error} ok={ok} />
      {enlace && <p>Enlace de cotización para el cliente: <a href={enlace}>{enlace}</a></p>}
      <div className="tabla-scroll">
        <table>
          <caption className="ayuda">Eventos del cliente</caption>
          <thead><tr><th scope="col">Evento</th><th scope="col">Fecha</th><th scope="col">Recinto</th><th scope="col">Aforo</th><th scope="col">Monto</th><th scope="col">Estado</th><th scope="col">Documentos</th></tr></thead>
          <tbody>
            {datos.length === 0 && <tr><td colSpan="7">Este cliente aún no tiene eventos.</td></tr>}
            {datos.map((k) => (
              <tr key={k.id}>
                <td>{k.titulo}</td><td>{k.fecha_evento}</td><td>{k.recinto}</td><td>{k.aforo}</td><td>{pesos(k.monto)}</td>
                <td><span className={`estado ${k.estado}`}>{ESTADOS[k.estado]}</span></td>
                <td>
                  {esAdmin ? (
                    <div className="fila">
                      {['cotizacion', 'contrato'].map((tipo) => (k.documentos[tipo]
                        ? <button key={tipo} className="sec" onClick={() => descargar(k.documentos[tipo])}>Descargar {tipo === 'contrato' ? 'contrato' : 'cotización'}</button>
                        : <label key={tipo} htmlFor={`arch-${tipo}-${k.id}`} className="ayuda">Adjuntar {tipo === 'contrato' ? 'contrato' : 'cotización'} (PDF) de {k.titulo}
                          <input id={`arch-${tipo}-${k.id}`} type="file" accept=".pdf,application/pdf" onChange={(e) => subir(k.id, tipo, e.target.files[0])} />
                        </label>))}
                      {k.documentos.cotizacion && <button className="sec" onClick={() => compartir(k.id)}>Enlace de cotización de {k.titulo}</button>}
                      {!k.confirmado && <button onClick={() => confirmar(k.id)}>Confirmar {k.titulo}</button>}
                    </div>
                  ) : <span className="ayuda">Solo lectura</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {esAdmin && (
        <form onSubmit={crear} aria-label="Nuevo evento">
          <h3>Nuevo evento</h3>
          <Campo id="k-titulo" etiqueta="Nombre del evento" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required />
          <Campo id="k-desc" etiqueta="Descripción" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          <Campo id="k-fecha" etiqueta="Fecha del evento" type="date" value={f.fecha_evento} onChange={(e) => setF({ ...f, fecha_evento: e.target.value })} required />
          <Campo id="k-recinto" etiqueta="Recinto" value={f.recinto} onChange={(e) => setF({ ...f, recinto: e.target.value })} required />
          <Campo id="k-aforo" etiqueta="Aforo (personas)" type="number" min="1" step="1" value={f.aforo} onChange={(e) => setF({ ...f, aforo: e.target.value })} required />
          <Campo id="k-monto" etiqueta="Monto en pesos" type="number" min="1" step="1" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} required ayuda="Número entero, sin puntos. Ejemplo: 4500000." />
          <button type="submit">Crear evento</button>
        </form>
      )}
    </main>
  );
}

// ---------- equipo de la productora (RF-3) ----------
function Usuarios({ productora }) {
  const [datos, setDatos] = useState([]); const [error, setError] = useState(''); const [f, setF] = useState({ usuario: '', rol: 'coordinador' });
  const cargar = async () => { try { setDatos((await api(`/api/productoras/${productora.id}/usuarios`)).datos); } catch (e) { setError(amable(e)); } };
  useEffect(() => { cargar(); }, [productora.id]); // eslint-disable-line
  async function agregar(e) { e.preventDefault(); setError(''); try { await api(`/api/productoras/${productora.id}/usuarios`, { metodo: 'POST', cuerpo: f }); setF({ usuario: '', rol: 'coordinador' }); cargar(); } catch (err) { setError(amable(err)); } }
  async function cambiarRol(id, rol) { try { await api(`/api/productoras/${productora.id}/usuarios/${id}`, { metodo: 'PUT', cuerpo: { rol } }); cargar(); } catch (err) { setError(amable(err)); } }
  async function quitar(id) { try { await api(`/api/productoras/${productora.id}/usuarios/${id}`, { metodo: 'DELETE' }); cargar(); } catch (err) { setError(amable(err)); } }
  return (
    <main id="contenido">
      <h2>Equipo de la productora</h2>
      <Mensaje error={error} />
      <div className="tabla-scroll"><table>
        <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{datos.map((u) => (
          <tr key={u.id}><td>{u.usuario}</td>
            <td><label htmlFor={`rol-${u.id}`} className="ayuda">Rol de {u.usuario}</label>
              <select id={`rol-${u.id}`} value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value)}><option value="administrador">administrador</option><option value="coordinador">coordinador</option></select></td>
            <td><button className="peligro" onClick={() => quitar(u.id)}>Quitar a {u.usuario}</button></td></tr>))}</tbody>
      </table></div>
      <form onSubmit={agregar} aria-label="Agregar usuario">
        <h3>Agregar usuario existente</h3>
        <Campo id="u-usuario" etiqueta="Nombre de usuario" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} required />
        <label htmlFor="u-rol">Rol<select id="u-rol" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}><option value="coordinador">coordinador (solo lectura)</option><option value="administrador">administrador</option></select></label>
        <button type="submit">Agregar</button>
      </form>
    </main>
  );
}

// ---------- auditoría (RF-6) ----------
function Auditoria({ productora }) {
  const [datos, setDatos] = useState([]); const [error, setError] = useState('');
  useEffect(() => { api(`/api/productoras/${productora.id}/auditoria`).then((r) => setDatos(r.datos)).catch((e) => setError(amable(e))); }, [productora.id]);
  return (
    <main id="contenido">
      <h2>Registro de auditoría</h2>
      <Mensaje error={error} />
      <div className="tabla-scroll"><table>
        <caption className="ayuda">Últimas acciones registradas</caption>
        <thead><tr><th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Acción</th><th scope="col">Objeto</th></tr></thead>
        <tbody>{datos.map((a) => <tr key={a.id}><td>{a.fecha}</td><td>{a.usuario_id}</td><td>{a.accion}</td><td>{a.objeto} {a.objeto_id}</td></tr>)}</tbody>
      </table></div>
    </main>
  );
}

// ---------- aplicación ----------
export default function App() {
  const [usuario, setUsuario] = useState(null); const [productora, setProductora] = useState(undefined);
  const [vista, setVista] = useState('clientes'); const [cliente, setCliente] = useState(null);

  async function cargarProductora() { const r = await api('/api/productoras'); setProductora(r.datos[0] || null); }
  useEffect(() => { if (usuario) cargarProductora(); }, [usuario]);
  useEffect(() => { document.title = `Tramoya - ${usuario ? vista : 'Acceso'}`; }, [vista, usuario]);

  async function salir() { try { await api('/api/auth/logout', { metodo: 'POST' }); } catch (e) { /* sesión ya inválida */ } token = null; setUsuario(null); setProductora(undefined); setCliente(null); setVista('clientes'); }

  const esAdmin = productora && productora.rol === 'administrador';
  const ir = (v) => () => { setVista(v); setCliente(null); };
  let cuerpo;
  if (!usuario) cuerpo = <Acceso onEntrar={setUsuario} />;
  else if (productora === undefined) cuerpo = <main id="contenido"><p>Cargando…</p></main>;
  else if (productora === null) cuerpo = <CrearProductora onCreada={cargarProductora} />;
  else if (cliente) cuerpo = <Eventos cliente={cliente} esAdmin={esAdmin} volver={() => setCliente(null)} />;
  else if (vista === 'usuarios' && esAdmin) cuerpo = <Usuarios productora={productora} />;
  else if (vista === 'auditoria' && esAdmin) cuerpo = <Auditoria productora={productora} />;
  else cuerpo = <Clientes productora={productora} esAdmin={esAdmin} onVerEventos={setCliente} />;

  return (
    <>
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <header className="top">
        <h1>Tramoya{productora ? ` · ${productora.nombre}` : ''}</h1>
        {usuario && productora && (
          <nav aria-label="Principal"><ul>
            <li><button aria-current={vista === 'clientes' && !cliente ? 'page' : undefined} onClick={ir('clientes')}>Clientes</button></li>
            {esAdmin && <li><button aria-current={vista === 'usuarios' ? 'page' : undefined} onClick={ir('usuarios')}>Equipo</button></li>}
            {esAdmin && <li><button aria-current={vista === 'auditoria' ? 'page' : undefined} onClick={ir('auditoria')}>Auditoría</button></li>}
            <li><button onClick={salir}>Cerrar sesión</button></li>
          </ul></nav>
        )}
      </header>
      {cuerpo}
    </>
  );
}
