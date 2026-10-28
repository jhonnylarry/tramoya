# Especificación de requerimientos de software: Tramoya

Versión 1.0, 28-10-2026. Autor: Jonathan Larraguibel (ISY1102, sección 002D).

## 1. Introducción

### 1.1 Propósito
Este documento define los requisitos de Tramoya, una plataforma web para que productoras de eventos pequeñas administren a sus clientes organizadores, los eventos que estos contratan, la cotización y el contrato de cada evento, y el registro de quién hizo cada cambio. Sirve como base para el plan de pruebas de la EP3 y para la defensa de la EP4.

### 1.2 Alcance
Usuarios objetivo: productoras de 2 a 15 personas que organizan ferias, conciertos, matrimonios y eventos corporativos, incluidas personas mayores de la administración que usan el sistema ocasionalmente. Tramoya no vende entradas, no procesa pagos ni administra proveedores; eso queda fuera de esta versión.

### 1.3 Base técnica
Tramoya se construye sobre un código base propio del autor (React, Express, autenticación JWT, roles, auditoría y respaldo), adaptado al dominio de eventos. Los requisitos no funcionales usan umbrales habituales para una aplicación web con datos personales.

### 1.4 Definiciones
- **Productora:** organización usuaria de Tramoya.
- **Cliente organizador:** persona natural o empresa que contrata un evento a la productora. Se identifica por RUT.
- **Evento:** servicio contratado por un cliente, con fecha, recinto, aforo y monto.
- **Cotización:** PDF con la propuesta económica enviada al cliente.
- **Contrato:** PDF firmado que formaliza el evento.
- **Administrador / coordinador:** roles dentro de una productora. El coordinador solo consulta.

## 2. Arquitectura y restricciones
- Frontend React con Vite; API REST en Node.js con Express; base de datos SQLite embebida en el prototipo (PostgreSQL en producción).
- Autenticación con JWT en cabecera `Authorization` y vigencia de 15 minutos.
- Documentos en almacenamiento interno del servidor, referenciados en la base de datos.
- Despliegue en contenedor Docker con usuario sin privilegios.
- Política de contraseñas: al menos 12 caracteres, con mayúscula, minúscula, número y símbolo.

## 3. Requisitos funcionales (17)

| ID | Requisito | Criterio de aceptación | Qué pierde la productora si falla |
|---|---|---|---|
| RF-1.1 | Iniciar sesión con usuario y contraseña. | Credenciales válidas entregan un JWT; inválidas, 401 sin indicar cuál dato falló. | Nadie del equipo puede trabajar, o un tercero averigua qué usuarios existen. |
| RF-1.2 | Cerrar sesión revocando el token. | Un token usado para cerrar sesión deja de ser aceptado. | Un computador compartido en un evento deja la sesión abierta. |
| RF-2.1 | Registrar un usuario. | Se rechaza una contraseña que no cumple la política; la contraseña se guarda con hash. | Cuentas débiles o contraseñas legibles si se filtra la base. |
| RF-2.2 | Crear una productora con nombre, dirección, teléfono y correo. | Datos obligatorios validados; respuesta 201. | No puede empezar a usar el sistema. |
| RF-2.3 | Quien crea la productora queda como administrador. | El rol devuelto es administrador. | La productora queda sin nadie que la administre. |
| RF-3.1 | El administrador agrega usuarios existentes al equipo y asigna su rol. | Solo se aceptan los roles administrador y coordinador. | No puede sumar a su equipo de terreno. |
| RF-3.2 | El coordinador solo consulta clientes y eventos. | Toda escritura de un coordinador responde 403 en el backend. | Un coordinador modifica montos o contratos sin autorización. |
| RF-3.3 | El administrador cambia el rol o quita a un usuario del equipo. | El usuario quitado pierde acceso. | Un ex colaborador sigue viendo datos de clientes. |
| RF-4.1 | Crear y listar clientes organizadores con paginación y búsqueda por nombre. | Listado paginado; filtro por nombre; campos opcionales pueden ir vacíos. | Pierde tiempo buscando al cliente durante una llamada. |
| RF-4.2 | Editar y eliminar clientes con confirmación explícita (eliminación lógica). | Sin confirmación responde 400; con confirmación el cliente queda inactivo. | Borra por error a un cliente con eventos vigentes. |
| RF-4.3 | Validar los datos del cliente: tipo (persona o empresa), RUT con dígito verificador y nombre sin caracteres no permitidos. | RUT con dígito incorrecto, tipo desconocido o nombre con `<` responden 400. | Cotizaciones y contratos emitidos a un RUT inexistente, que después no se pueden facturar. |
| RF-5.1 | Crear un evento para un cliente con nombre, fecha, recinto, aforo y monto. | Fecha válida, recinto obligatorio, aforo entero mayor que cero; el evento nace como cotizado. | Eventos sin fecha o sin lugar que el equipo no puede planificar. |
| RF-5.2 | Adjuntar a cada evento una cotización y un contrato, solo en PDF y uno de cada tipo. | Archivo que no sea PDF real se rechaza; un segundo contrato responde 409. | Se envía al cliente un archivo equivocado o malicioso. |
| RF-5.3 | Guardar los documentos en almacenamiento interno con nombre generado y referencia en la base. | El nombre interno no se deriva del nombre que sube el usuario. | Un nombre de archivo manipulado sobrescribe otros documentos. |
| RF-5.4 | Calcular el estado del evento: cotizado (sin confirmar), confirmado, próximo (confirmado y a 30 días o menos) y realizado (confirmado y con fecha pasada). Confirmar un evento es una acción explícita del administrador. | Los cuatro estados se calculan según la fecha y la confirmación. | El equipo no ve qué eventos vienen pronto y llega tarde a la producción. |
| RF-5.5 | Generar un enlace de cotización para que el cliente la descargue sin cuenta. | Solo se genera si hay cotización; el contrato no se comparte por enlace. | El cliente no recibe la propuesta, o recibe el contrato antes de tiempo. |
| RF-6.1 | Registrar en auditoría las acciones críticas (crear, editar, eliminar, subir, confirmar, compartir, descargar). | Cada registro tiene usuario, fecha, acción y objeto. | No puede reconstruir quién cambió un monto o confirmó un evento. |

## 4. Requisitos no funcionales (20)

| ID | Requisito | Umbral o criterio |
|---|---|---|
| NFR-SEG-1 | Todas las comunicaciones cifradas con TLS. | HTTPS obligatorio y cabecera HSTS. |
| NFR-SEG-2 | Contraseñas almacenadas con hash bcrypt. | Ninguna contraseña legible en la base. |
| NFR-SEG-3 | Datos sensibles y documentos cifrados en reposo. | Contratos y cotizaciones cifrados en disco. |
| NFR-SEG-4 | Control de acceso por rol y por productora validado en el backend. | Cero accesos cruzados entre productoras. |
| NFR-SEG-5 | Protección contra XSS, inyección SQL y CSRF; validación de entrada; límite de intentos de inicio de sesión; dependencias sin vulnerabilidades altas. | Sin hallazgos críticos ni altos abiertos. |
| NFR-SEG-6 | Registros sin contraseñas ni hashes. | Ninguna credencial en auditoría. |
| NFR-SEG-7 | Respaldo y recuperación con política escrita. | RPO 24 h, RTO 4 h, restauración probada. |
| NFR-SEG-8 | Cumplimiento de la normativa de datos personales (Ley 19.628 y Ley 21.719). | Procedimiento de supresión a solicitud del titular y plazo de retención. |
| NFR-SEG-9 | Sesión con JWT firmado con un secreto propio del despliegue y vigencia corta. | Sin secretos por defecto; 15 minutos de vigencia. |
| NFR-PERF-1 | Operaciones CRUD simples rápidas. | Promedio menor a 300 ms; error menor a 1 %. |
| NFR-PERF-2 | Página principal rápida en móvil. | LCP menor a 2 s con emulación móvil. |
| NFR-PERF-3 | Soporte de usuarios concurrentes. | 200 usuarios concurrentes sin errores relevantes. |
| NFR-USAB-1 | Interfaz legible para personas mayores. | Tipografía base de 12 px o más, contraste WCAG 2.1 AA, controles de 44 px. |
| NFR-USAB-2 | Navegación completa con teclado. | Enlace para saltar al contenido y foco visible. |
| NFR-USAB-3 | Mensajes de error claros, en español correcto. | Cada error indica qué corregir. |
| NFR-USAB-4 | Flujo de trabajo: primero el cliente, luego sus eventos. | Desde un cliente se llega a sus eventos en un paso. |
| NFR-DIS-1 | Disponibilidad mensual. | 99,5 % en producción. |
| NFR-DIS-2 | Mantenimiento planificado. | Ventanas fuera del horario de eventos y migraciones con respaldo previo. |
| NFR-COMPAT-1 | Navegadores soportados. | Últimas dos versiones de Chrome, Firefox, Safari y Edge. |
| NFR-COMPAT-2 | Diseño responsivo. | Sin desplazamiento horizontal en 375, 768 y 1440 px. |

## 5. Reglas de negocio (8)

| ID | Regla | Qué pierde la productora si no se cumple |
|---|---|---|
| RB-1 | El correo principal de una productora es único. | Dos cuentas para la misma productora, con datos repartidos. |
| RB-2 | Solo los usuarios de una productora acceden a sus datos. | Una productora de la competencia ve clientes y montos. |
| RB-3 | Cada evento pertenece a un solo cliente organizador. | Un evento cobrado a dos clientes o a ninguno. |
| RB-4 | El coordinador tiene acceso de solo lectura. | Cambios no autorizados en montos, contratos o confirmaciones. |
| RB-5 | El administrador tiene acceso completo a su productora. | El dueño no puede corregir sus propios datos. |
| RB-6 | No puede haber dos eventos confirmados en el mismo recinto y la misma fecha. | Doble reserva de un recinto: un evento se cae y hay que indemnizar al cliente. |
| RB-7 | Un evento no se confirma sin su contrato en PDF adjunto. | Se moviliza equipo y proveedores para un evento sin respaldo legal. |
| RB-8 | El monto de un evento es un entero en pesos chilenos mayor que cero, y el enlace de cotización vence a los 7 días y se puede revocar. | Montos con decimales o en cero que no se pueden facturar; cotizaciones antiguas circulando con precios vencidos. |

Total: 45 requisitos (17 RF, 20 NFR y 8 RB).

## 6. Requisitos propios del dominio de eventos
RF-4.3 (tipo y RUT), RF-5.1 (fecha, recinto, aforo y monto), RF-5.2 (cotización y contrato, solo PDF), RF-5.4 (estados de evento y confirmación), RF-5.5 (enlace de cotización), RB-6, RB-7 y RB-8. Cada uno tiene al menos un caso de prueba en el plan (CP-18 a CP-23 y CP-31 a CP-37).
