# EP4: guion de la defensa y preguntas probables

Presentación: 10 láminas, unos 8 minutos de lectura (deja margen para pausas). El guion completo de cada lámina está en las notas del orador de la presentación; abajo va la versión resumida para estudiar.

## Guion por lámina

| # | Lámina | Tiempo | Idea que no puede faltar |
|---|---|---|---|
| 1 | Portada | 0:20 | Qué es Tramoya y el orden de la exposición. |
| 2 | Reglas del negocio | 0:50 | 45 requisitos. RB-6, RB-7 y RB-8 con lo que pierde la productora si fallan. |
| 3 | Enfoque estratégico | 0:50 | Prioridad por riesgo en cuatro niveles. Casos negativos: con solo el flujo feliz no aparece ningún defecto. |
| 4 | Herramientas | 0:45 | Las que pidió el profesor (Jest, JMeter, SonarQube, Lighthouse) y para qué sirve cada una de las demás. |
| 5 | Ejecución | 1:00 | 39/39, 29 ms con 200 usuarios, LCP 1,4 s, WebKit 16/18, SonarQube C, 9 vulnerabilidades. Las primeras corridas de JMeter se descartaron por un error de montaje, y lo digo. |
| 6 | Cobertura | 0:45 | Diseño 100 %, ejecución 95,6 %, código 93,3 %. Por qué SonarQube dice 68,9 %. |
| 7 | Defectos | 0:55 | 16 incidentes en 4 niveles; crítico INC-02; INC-07 queda en observación, no cerrado. |
| 8 | Hallazgo INC-16 | 0:55 | SonarQube lo marcó y yo lo reproduje: 8,3 s de bloqueo con una sola solicitud. |
| 9 | Reflexiones | 1:00 | Calidad, seguridad, normativa (Ley 21.719) y ética (Ley 21.459, transparencia). |
| 10 | Dictamen | 0:45 | No certificado para producción; condiciones para certificar. |

Total aproximado: 8:05.

### Si preguntan por el origen del código
Respuesta corta y verdadera: «Partí de un código base propio que había hecho antes en el curso y lo adapté a este dominio, con requisitos y reglas de negocio propios». No hace falta extenderse, pero no lo niegues.

## 10 preguntas probables

1. **¿Qué tiene de propio este proyecto?**
   El dominio de eventos, sus datos (RUT, recinto, aforo, monto), los estados y tres reglas de negocio (RB-6 a RB-8), con sus casos (CP-31 a CP-37, NF-15 y NF-16). La base técnica es código propio reutilizado (sección 1.3 del informe).

2. **¿Por qué no corregiste el incidente crítico si es tan simple?**
   Porque la decisión de corregir se dejó explícitamente para después de reportar; el objetivo de esta etapa era verificar y certificar, no maquillar el resultado. La corrección es simple: quitar el valor por defecto y abortar el arranque sin JWT_SECRET. Por eso el dictamen es no certificado.

3. **¿Cómo sabes que INC-16 es real y no un falso positivo de SonarQube?**
   Lo reproduje: medí el tiempo de la validación con correos de 5, 20 y 50 mil caracteres (crece de forma cuadrática) y envié uno de 95 mil al registro: 8,3 s sin atender a nadie. Está en evidencia/redos_correo.txt.

4. **¿Por qué los tiempos de JMeter son tan bajos? ¿Son creíbles?**
   Son consultas simples sobre SQLite en memoria y en la misma máquina, sin red real. Por eso los declaro referenciales: cumplen el umbral, pero hay que repetirlos con PostgreSQL y en infraestructura real.

5. **¿Qué pasó con las primeras corridas de JMeter con 100 % de error?**
   Respondieron 401 porque el script de preparación no obtuvo un token válido (el servidor no estaba listo o quedó otro proceso en el puerto). Era un error del montaje, no del sistema. Las descarté, lo dejé escrito en el informe y las repetí con jmeter/ejecutar.sh, que espera al servidor y lo inicia limpio.

6. **¿Por qué la cobertura de SonarQube (68,9 %) es distinta de la de Jest (93,3 %)?**
   SonarQube incluye el frontend, que no tiene pruebas Jest; el frontend se prueba con Playwright en tres navegadores. Jest mide solo la API.

7. **¿Por qué falla Safari y qué tan grave es?**
   Safari por defecto no incluye enlaces en el orden de tabulación, así que el primer Tab salta el enlace «Saltar al contenido». El login con teclado sí funciona desde el campo de usuario. Es leve, pero rompe un criterio WCAG para quien navega con teclado en Safari.

8. **¿Cómo se relaciona Tramoya con la Ley 21.719?**
   Guarda RUT y contacto de personas. La ley exige medidas de seguridad, permitir supresión a pedido del titular y notificar brechas. Faltan el cifrado en reposo (INC-04), la supresión definitiva (INC-06) y TLS (INC-03).

9. **¿Qué es INC-07 y por qué no lo cerraste?**
   En la evaluación anterior hubo 3 timeouts con 200 conexiones. En mi equipo, con JMeter y autocannon, no se repitió. No lo cierro porque «no reproducido» no es «corregido»; queda en observación hasta probar en producción con PostgreSQL.

10. **¿Qué harías primero para llevarlo a producción?**
    En orden: INC-02 (secreto JWT), INC-16 (expresión regular), actualizar Express y compression (INC-01), TLS y cabeceras (INC-03, INC-09), cifrado de documentos (INC-04) y límite de intentos (INC-05). Después repetir toda la suite y lograr seguridad A en SonarQube.
