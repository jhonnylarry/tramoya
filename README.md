# Tramoya

Plataforma web para productoras de eventos pequeñas: clientes organizadores (con RUT), eventos con fecha, recinto, aforo y monto, cotización y contrato en PDF, confirmación de eventos, enlace de cotización para el cliente y auditoría.

Proyecto de la asignatura ISY1102 Seguridad y calidad en el desarrollo de software (Duoc UC, sección 002D). Incluye el plan de pruebas, su ejecución y el informe de certificación.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/` | API REST en Node.js con Express y SQLite (`node:sqlite`) |
| `frontend/` | Interfaz en React con Vite |
| `test/` | Pruebas automatizadas con Jest y Supertest (CP-01 a CP-37 y respaldo) |
| `e2e/` | Pruebas de extremo a extremo con Playwright y axe-core, y medición con Lighthouse |
| `jmeter/` | Plan de rendimiento de JMeter y script de ejecución |
| `scripts/` | Respaldo y restauración con verificación SHA-256 |
| `docs/` | Especificación de requisitos (`ERS_Tramoya.md`) y material de la defensa |
| `informe/` | Informe EP3 (PDF y Word) y el script que lo genera |
| `evidencia/` | Salidas de todas las herramientas, reportes HTML de JMeter y capturas |

## Requisitos

Node.js 22 o superior. Para las pruebas adicionales: Java 17 o superior (JMeter), Docker, Python con `njsscan` y `semgrep`.

## Instalación y ejecución

```bash
npm install
(cd frontend && npm install && npm run build)
PORT=3000 JWT_SECRET=una-clave-propia node src/server.js
```

La aplicación queda en http://localhost:3000. Define siempre `JWT_SECRET`: el valor por defecto del código es un incidente crítico documentado (INC-02).

## Pruebas

```bash
npx jest --coverage                                  # funcionales, reglas de negocio y seguridad
npx eslint src && njsscan src && npm audit --omit=dev  # análisis estático y dependencias
BASE=http://localhost:3000 MOTOR=chromium node e2e/e2e.js   # también firefox o webkit
BASE=http://localhost:3000/ node e2e/lighthouse.mjs
./jmeter/ejecutar.sh 200                             # JMeter en modo no gráfico
sonar-scanner -Dsonar.host.url=http://localhost:9000 # con SonarQube levantado en Docker
./docker_verificar.sh                                # construye y prueba la imagen
```

## Estado

El informe de certificación (sección 8 del informe) concluye **no certificado para producción**: los requisitos funcionales y de rendimiento se cumplen, pero hay un incidente crítico y cinco graves de seguridad abiertos. El detalle está en `informe/Informe_EP3_ISY1102_Jonathan_Larraguibel.pdf`.

Los datos usados en las pruebas son sintéticos.

## Autor

Jonathan Larraguibel
