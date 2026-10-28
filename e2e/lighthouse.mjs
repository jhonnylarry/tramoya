import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
const chrome = await chromeLauncher.launch({ ...(process.env.CHROME ? { chromePath: process.env.CHROME } : {}), chromeFlags: ['--headless=new', '--no-sandbox'] });
const url = process.env.BASE || 'http://localhost:3000/';
const salida = {};
for (const modo of ['mobile', 'desktop']) {
  const cfg = modo === 'desktop' ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } } : undefined;
  const r = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, cfg);
  const c = r.lhr.categories, a = r.lhr.audits;
  salida[modo] = {
    version: r.lhr.lighthouseVersion, url,
    puntajes: { rendimiento: Math.round(c.performance.score * 100), accesibilidad: Math.round(c.accessibility.score * 100), buenas_practicas: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100) },
    metricas: { FCP: a['first-contentful-paint'].displayValue, LCP: a['largest-contentful-paint'].displayValue, TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, SpeedIndex: a['speed-index'].displayValue },
    LCP_ms: Math.round(a['largest-contentful-paint'].numericValue),
    fallas: Object.values(r.lhr.audits).filter((x) => x.score !== null && x.score < 1 && x.scoreDisplayMode === 'binary').map((x) => x.id),
  };
}
await chrome.kill();
fs.writeFileSync('evidencia/lighthouse.json', JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
