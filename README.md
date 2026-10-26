# Finanzas personales • versión 1.3

App responsive para tarjetas de crédito, MSI, registro de movimientos, gastos e ingresos, efectivo, conciliación y créditos de vehículo. 100% separada de SUDMAR.

## Instalación

1. **Ya creado**: Supabase independiente `brujula-finanzas` (`krilcvtobjzffffleebb`), sin usar el proyecto SUDMAR.
2. **Ya ejecutado**: `schema.sql` y refuerzos de relaciones en Supabase. El archivo SQL incluido es para referencia o instalaciones NUEVAS; **no volver a ejecutarlo** sobre el proyecto existente.
3. Habilitar Supabase Auth / Email (y configurar los ajustes de registro según tus necesidades). Crear primero tu usuario y deshabilitar registros públicos si será personal.
4. **Ya configurado**: `config.js` tiene la URL y clave **publishable** (pública) de Brújula. Nunca incluyas claves secretas, service_role ni credenciales de banco.
5. **Pendiente**: publicar `index.html`, `app.js`, `styles.css` y `config.js` en hosting HTTPS, idealmente en repositorio NUEVO y separado de SUDMAR. GitHub Pages no oculta código ni archivos publicados, por eso `config.js` solo contiene valores públicos.
6. **Pendiente**: configurar y verificar Supabase Auth (el registro de cuentas no se ha probado), publicar y probar inicio de sesión, CRUD y consultas antes de capturar datos reales.

## Modo demostración

Abre `index.html` mediante un servidor estático (`python -m http.server 8080`) y pulsa **Explorar demo**. Los datos son ficticios, solo viven en memoria y desaparecen al recargar. No uses demo para datos personales.

## Reglas contables

- Un movimiento de tarjeta **compra** aumenta la deuda; un **pago** la reduce. Ingresos y gastos de efectivo afectan el saldo disponible. No volver a sumar las mensualidades MSI como nuevos cargos de la tarjeta si ya se registró la compra total.
- MSI registran calendario de amortización **informativo**. Primer mes de cobro es explícito, pues depende del banco y fecha de corte. El monto restante de MSI se incluye en la deuda ya registrada, no se suma dos veces.
- Para **pago para no generar intereses** la cifra válida es la capturada desde el estado de cuenta bancario (`statements`), no una estimación hecha con movimientos. Los pagos vinculados al estado de cuenta pueden descontarse del importe pendiente.
- La **disponibilidad** de una tarjeta es estimada si existen retenciones pendientes, movimientos no conciliados, cargos bancarios o saldos iniciales incompletos. Priorizar la cifra oficial capturada del estado de cuenta.
- En **créditos**, pagos de nómina se registran de forma separada y no generan doble salida de caja. El capital pendiente solo se estima si se captura la parte de capital de cada pago, de lo contrario debe consultarse la tabla de amortización.
- Todos los importes son MXN; fechas se registran como ISO `YYYY-MM-DD` para evitar desplazamientos de zona horaria.

## Seguridad

- Tablas bajo RLS, un propietario por fila, claves foráneas de propiedad cruzada y acceso autenticado obligatorio.
- No registrar el número completo de tarjeta, CVV, NIP ni claves bancarias. Solo últimos cuatro dígitos.
- Exportar CSV descarga datos personales a tu equipo; resguárdalos de forma segura.
- La aplicación no inicia sesión en bancos ni ejecuta pagos. Conciliación es manual.

## Alcance pendiente para producción ampliada

Importación bancaria automatizada / lectores PDF, alertas push o WhatsApp, pagos recurrentes, reintentos transaccionales de operaciones compuestas, auditoría de modificaciones y pruebas end-to-end en ambiente Supabase real.

## Nuevo en v1.1: uso de tarjetas después del corte

- Panel principal «¿Qué tarjeta me conviene utilizar hoy?» por orden de ciclo confirmado, corte próximo y disponible calculado.
- Se marca **después del corte confirmado** solo si se registró un estado de cuenta real del banco. Una fecha orientativa sola nunca se presenta como confirmación.
- Día de corte orientativo y margen de variación configurable (0 a 3 días). Se solicita verificar un corte cercano o un estado de cuenta faltante.
- Alertas en el panel al faltar los días configurados (1 a 7) para **la fecha exacta de vencimiento del estado de cuenta registrado**.
- El crédito disponible parte, si existe, del disponible que informó el banco en el último corte, ajustado por movimientos posteriores registrados en la aplicación. No contempla autorizaciones/retenciones que el usuario no haya capturado.
- El registro del estado de cuenta permite corregir la fecha real de corte y la fecha real de pago, que pueden variar mes a mes.
- Las recomendaciones no autorizan gastar, no garantizan cupo, ni sustituyen la verificación bancaria.

Si ya existe una base Brújula v1.0, aplica antes el archivo `migrate_v1_1.sql`. No ejecutes este script sobre SUDMAR.

## Avance de despliegue (25 octubre 2026)

- Supabase Brújula: creado con costo cotizado $0/mes adicional al crearlo, dentro del plan de la organización (sujeto a límites).
- Seis tablas privadas: aplicadas, RLS activado y advisor de seguridad sin alertas al momento de la primera revisión.
- Sin datos bancarios importados ni datos personales cargados en producción.
- GitHub: aún no existe un repositorio nuevo de Brújula; el acceso actual no permite crear repositorios, por eso **NO** se han modificado repositorios de SUDMAR.
- Esta distribución está configurada para Supabase, pero requiere hosting HTTPS y prueba funcional del flujo de autenticación antes de uso real.


## v1.3: modo en línea e instalable

- La única fuente de registros reales es Supabase: toda compra/pago/cuenta se guarda en la nube bajo acceso autenticado.
- **Instalable como PWA** al publicarse mediante HTTPS: en Android, abrir el sitio desde Chrome y elegir «Instalar aplicación» o «Agregar a pantalla principal».
- El SW guarda solo los archivos públicos de la interfaz; NO almacena movimientos, tokens bancarios o tablas Supabase en su caché.
- Para agregar/modificar datos reales hace falta conexión a internet. No existe captura offline en esta versión.
- Se refrescan los registros al volver a la app, y hay botón ⟳ para actualizar manualmente.
- Pendiente la publicación y verificación de funcionamiento con un usuario real.
