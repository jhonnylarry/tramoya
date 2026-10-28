// Pruebas de extremo a extremo (navegador real) + accesibilidad automatica (axe) + viewports
const pw = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const MOTOR = process.env.MOTOR || 'chromium'; // chromium, firefox o webkit (NFR-COMPAT-1)
const SUF = MOTOR === 'chromium' ? '' : `_${MOTOR}`;
const PW = 'Clave-Segura-2026!';
const res = [];
const reg = (id, ok, det) => { res.push({ id, ok, det }); console.log(`${ok ? 'PASA ' : 'FALLA'} ${id} ${det || ''}`); };

(async () => {
  const browser = await pw[MOTOR].launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  console.log('Motor:', MOTOR, browser.version());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const sufijo = Date.now().toString().slice(-6);
  const usuario = `ana${sufijo}`;

  // E2E-01 registro y login
  await page.goto(BASE);
  await page.getByRole('button', { name: /No tengo cuenta/ }).click();
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Correo electrónico').fill(`${usuario}@pyme.cl`);
  await page.getByLabel('Contraseña').fill('corta');
  await page.getByRole('button', { name: 'Registrarme' }).click();
  const msgPolitica = await page.getByRole('alert').innerText();
  reg('E2E-01a politica de contrasena visible al usuario', /12 caracteres/.test(msgPolitica), msgPolitica);
  await page.getByLabel('Contraseña').fill(PW);
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña').fill(PW);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { name: 'Cree su productora' }).waitFor();
  reg('E2E-01b registro e inicio de sesion llevan a crear productora', true);

  // accesibilidad de pantallas (axe)
  async function axe(nombre) {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const graves = r.violations.map((v) => `${v.id}(${v.impact}, ${v.nodes.length} nodos)`);
    reg(`AXE ${nombre}`, r.violations.length === 0, graves.join('; ') || '0 violaciones WCAG 2.1 A/AA');
    return r.violations;
  }
  await axe('crear productora');
  await page.screenshot({ path: `evidencia/capturas/02_crear_productora${SUF}.png` });

  // E2E-02 crear productora y primer cliente
  await page.getByLabel('Nombre de la productora').fill('Producciones Aurora');
  await page.getByLabel('Dirección').fill('Av. Providencia 1234');
  await page.getByLabel('Teléfono').fill('221234567');
  await page.getByLabel('Correo de la productora').fill(`contacto${sufijo}@aurora.cl`);
  await page.getByRole('button', { name: 'Crear productora' }).click();
  await page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor();
  reg('E2E-02 crear productora deja al usuario como administrador en Clientes', await page.getByRole('button', { name: 'Crear cliente' }).isVisible());

  await page.getByLabel('RUT').fill('12.345.678-4');
  await page.getByLabel('Nombre', { exact: true }).fill('Feria Raices');
  await page.getByLabel('Información de contacto').fill('raices@cliente.cl');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  const msgRut = await page.getByRole('alert').innerText();
  reg('E2E-03b RUT con digito verificador incorrecto muestra mensaje claro', /dígito verificador/.test(msgRut), msgRut);
  await page.getByLabel('RUT').fill('12.345.678-5');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await page.getByText('Cliente creado.').waitFor();
  await axe('clientes');
  await page.screenshot({ path: `evidencia/capturas/03_clientes${SUF}.png` });

  // E2E-03 validacion de nombre invalido
  await page.getByLabel('RUT').fill('76.086.428-5');
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente <script>');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  const msgVal = await page.getByRole('alert').innerText();
  reg('E2E-03 mensaje amigable ante dato invalido', /Revise los datos del cliente/.test(msgVal), msgVal);

  // E2E-04 flujo cliente -> eventos (NFR-USAB-4), evento, contrato y confirmacion (RB-7)
  await page.getByRole('button', { name: /Ver eventos de Feria Raices/ }).click();
  await page.getByRole('heading', { name: /Eventos de Feria Raices/ }).waitFor();
  const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Nombre del evento').fill('Feria de primavera');
  await page.getByLabel('Fecha del evento').fill(enDias(20));
  await page.getByLabel('Recinto').fill('Parque Bustamante');
  await page.getByLabel('Aforo (personas)').fill('600');
  await page.getByLabel('Monto en pesos').fill('3800000');
  await page.getByRole('button', { name: 'Crear evento' }).click();
  await page.getByText('Evento creado como cotizado.').waitFor();
  const estado1 = await page.locator('.estado').first().innerText();
  reg('E2E-04 evento nuevo queda en estado Cotizado', estado1 === 'Cotizado', `estado=${estado1}`);
  await page.getByRole('button', { name: 'Confirmar Feria de primavera' }).click();
  const msgSinContrato = await page.getByRole('alert').innerText();
  reg('E2E-05a RB-7 no permite confirmar sin contrato y lo explica', /adjunte el contrato/.test(msgSinContrato), msgSinContrato);
  fs.writeFileSync('/tmp/contrato.pdf', '%PDF-1.4 prueba');
  await page.getByLabel(/Adjuntar contrato \(PDF\) de Feria de primavera/).setInputFiles('/tmp/contrato.pdf');
  await page.getByText('Contrato adjuntado.').waitFor();
  await page.getByRole('button', { name: 'Confirmar Feria de primavera' }).click();
  await page.getByText('Evento confirmado.').waitFor();
  const estado2 = await page.locator('.estado').first().innerText();
  reg('E2E-05b con contrato adjunto el evento a 20 dias queda Proximo', estado2 === 'Próximo', `estado=${estado2}`);
  await axe('eventos');
  await page.screenshot({ path: `evidencia/capturas/04_eventos${SUF}.png`, fullPage: true });

  // E2E-06 navegacion solo con teclado: skip link y foco visible
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => { const a = document.activeElement; return `${a.tagName}.${a.className}:${(a.textContent || '').slice(0, 30)}`; });
  reg('E2E-06 primer Tab enfoca el enlace "Saltar al contenido"', /^A\.saltar/.test(foco), foco);
  // login solo con teclado
  await page.keyboard.press('Tab'); await page.keyboard.type(usuario);
  await page.keyboard.press('Tab'); await page.keyboard.type(PW);
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor({ timeout: 5000 }).then(() => reg('E2E-07 login completo usando solo teclado', true), () => reg('E2E-07 login completo usando solo teclado', false));

  // tamano minimo de controles tactiles
  const chicos = await page.evaluate(() => [...document.querySelectorAll('button, input, select, a')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44) && !e.classList.contains('saltar') && e.type !== 'file'; }).map((e) => (e.textContent || e.id).slice(0, 25)));
  reg('E2E-08 controles interactivos de al menos 44 px', chicos.length === 0, chicos.join(', ') || 'todos >= 44 px');
  const fuente = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  reg('E2E-09 tipografia base de al menos 12 px (ERS 3.1.1)', parseFloat(fuente) >= 12, fuente);

  // viewports (NFR-COMPAT-2): sin scroll horizontal
  for (const [nombre, w, h] of [['movil', 375, 812], ['tablet', 768, 1024], ['escritorio', 1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(200);
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    reg(`RESP-${nombre} (${w}x${h}) sin desborde horizontal`, !desborda);
    await page.screenshot({ path: `evidencia/capturas/05_${nombre}${SUF}.png` });
  }
  await browser.close();
  fs.writeFileSync(`evidencia/e2e_resultados${SUF}.json`, JSON.stringify(res, null, 2));
  console.log(`\nTotal: ${res.length} | Pasaron: ${res.filter((r) => r.ok).length} | Fallaron: ${res.filter((r) => !r.ok).length}`);
})().catch((e) => { console.error('ERROR e2e:', e.message); process.exit(1); });
