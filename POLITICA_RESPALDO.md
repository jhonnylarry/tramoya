# Política de respaldo y recuperación de Tramoya (NFR-SEG-7)
- Alcance: base de datos y carpeta de documentos (storage).
- Frecuencia: respaldo completo diario (fuera del horario laboral) y antes de cada actualización (NFR-DIS-2).
- Retención: 30 respaldos diarios y 12 mensuales; los respaldos con datos personales se eliminan al vencer el plazo.
- Objetivos: RPO 24 horas; RTO 4 horas.
- Herramienta: `node scripts/respaldo.js respaldar|restaurar` (copia consistente con VACUUM INTO + manifiesto SHA-256; rechaza respaldos alterados).
- Prueba de restauración: mensual, en un entorno separado, registrando fecha, tiempo y resultado. Prueba automatizada: test/respaldo.test.js.
- Pendiente (relacionado con INC-04): cifrar los respaldos y guardarlos fuera del servidor principal.
