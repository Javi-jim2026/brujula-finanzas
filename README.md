# Brújula Finanzas · v1.5

Aplicación personal de control de tarjetas, meses sin intereses, movimientos, estados de cuenta, efectivo y créditos. **Proyecto independiente de SUDMAR.**

## Estado actual (26 oct 2026)
- Código de la PWA incorporado al repositorio público en GitHub Pages (`main`).
- Proyecto de Supabase separado: `brujula-finanzas` (ref: `krilcvtobjzffffleebb`).
- Base de datos creada con seis tablas y reglas de seguridad a nivel fila (RLS).
- Migración `credit_opening_baseline_wizard_v14` aplicada con campos de fecha y modalidad de saldo inicial, pagos previos y fecha de crédito disponible.
- Asistente guiado de tres pasos para alta y edición de tarjetas; conserva los registros que ya existían.
- **Publicada** en https://javi-jim2026.github.io/brujula-finanzas/ mediante GitHub Actions. Los flujos incluyen pruebas automáticas, pero la revisión final de formularios y documentos bancarios en Android requiere pruebas del propietario.
- Nunca introducir contraseñas bancarias, número completo de tarjeta, NIP ni CVV.

## Archivos
- `index.html`, `app.js`, `styles.css`: interfaz de usuario.
- `config.js`: URL y **clave publicable** del proyecto Supabase (no es una clave secreta).
- `manifest.webmanifest`, `sw.js`, iconos: instalación como aplicación web (PWA).
- `schema.sql`, `migrate_v1_1.sql`: referencias históricas de esquema. **No volver a ejecutarlos en Supabase**, la base ya está creada.

## Publicación
Una cuenta GitHub Free solo permite GitHub Pages desde repositorios **públicos**. Para conservar este repositorio **privado**, usar GitHub Pro/Team o un hosting estático externo compatible con repositorios privados. En ambos casos, el sitio web de inicio de sesión puede ser público; la privacidad de los datos depende de Supabase Auth + RLS.

Se incorporó el flujo de GitHub Actions `.github/workflows/pages.yml`, que publica **solo** HTML, CSS, JS, manifiesto e iconos (no publica SQL ni documentación). Para habilitarlo por primera vez con GitHub Free: 1) `Settings > General > Danger Zone > Change repository visibility > Public`; 2) `Settings > Pages > Build and deployment > Source > GitHub Actions`; 3) abrir `Actions > Publicar Brújula Finanzas > Run workflow` (rama `main`). El sitio publicado es `https://javi-jim2026.github.io/brujula-finanzas/` (confirmar que la última ejecución de Actions haya terminado correctamente). **No registrar datos bancarios reales antes de probar autenticación y aislamiento**.

## Validación previa a uso real
1. Publicar bajo HTTPS.
2. Probar creación/confirmación de usuario y acceso desde Android.
3. Crear tarjeta de prueba, registrar compra, pago, estado de cuenta y MSI.
4. Verificar aislamiento por usuario y actualización de datos.
5. Comparar cálculo estimado con **pago para no generar intereses** oficial del banco; este último manda.

No hay datos bancarios reales en este repositorio. La aplicación requiere internet para consultar y guardar información.

## Comprobación de publicación
- Repositorio público configurado por el propietario el 26 de octubre de 2026.
- Flujo de publicación: `.github/workflows/pages.yml`.
- URL esperada tras completarse el despliegue: https://javi-jim2026.github.io/brujula-finanzas/
- **No se deben ingresar datos reales hasta verificar que autenticación, acceso y cálculos funcionan.**


## Alta segura de tarjetas (v1.4)
- **Desde último estado de cuenta**: indicar fecha del corte, deuda total a ese corte (incluido capital MSI futuro) y opcionalmente pago oficial para no generar intereses, fecha límite y disponible reportado.
- **Desde saldo actual**: indicar una fecha de referencia y la deuda total de ese día; después solo se incorporan compras, pagos y ajustes posteriores. Si registra un corte anterior, su disponible corresponde a la fecha inicial, no necesariamente a la fecha de corte.
- **Tarjetas existentes**: permanecen con `opening_balance_mode=legacy` y sin fecha. Ningún registro se modifica automáticamente; el propietario puede usar **Editar** para establecer el inicio. No se permite mover el inicio sobre movimientos ya capturados.
- **MSI**: el alta histórica ya queda absorbida en la deuda total inicial. Los MSI nuevos requieren vincular una compra real posterior en Movimientos. El plan nunca incrementa por sí solo la deuda. Así no se cuenta dos veces.
- **Pagos pendientes**: el pago bancario para no generar intereses permanece separado de la deuda total. Brújula descuenta solo pagos vinculados al corte, más los pagos previos al inicio cuando se declararon expresamente. Si el importe bancario ya es el restante, dejar pagos previos en cero.
- El banco puede mostrar retenciones o ajustes no registrados: el importe calculado por Brújula siempre es una estimación hasta conciliar.
- La función SQL `public.save_credit_start(jsonb,jsonb)` realiza creación/edición y corte inicial de forma atómica; funciona bajo RLS y solo para usuario autenticado.
- El pipeline de GitHub Pages ejecuta pruebas del motor financiero antes de publicar.

## Ampliación v1.5 — control diario y gastos fijos

- **Gastos fijos**: altas de gastos o ingresos periódicos (semanal, cada 14 días, mensual o anual), suma de importe mensual equivalente, estado activo/pausado y confirmación manual. La confirmación **NO crea movimientos, no cambia saldos y no cobra en bancos**. La automatización de cargos se decidirá con el propietario, en otro paso.
- **Calendario**: compromisos de gastos fijos, préstamos y pagos de estados de cuenta. Presenta estimaciones y advierte cuando puede haber obligaciones registradas más de una vez. No descuenta automáticamente proyecciones del saldo actual ni presume cobros futuros.
- **Presupuestos**: límites por categoría y mes; compara contra compras y gastos reales (excluye abonos de tarjetas, transferencias y planes MSI informativos).
- **Importación**: procesamiento local de archivos CSV, XLS, XLSX o PDF con texto extraíble; vista previa editable, importación de filas confirmadas y huella por archivo/fila para evitar importar el mismo documento dos veces. Puede no reconocer estados de cuenta bancarios con columnas o formatos distintos; los PDF escaneados no están soportados. No se envía ni almacena el PDF/Excel original. Nunca crear estados de cuenta oficiales a partir de montos inferidos.
- **Avisos**: lista de próximos vencimientos y permiso para avisos del navegador cuando se abre Brújula. La entrega remota de notificaciones con la aplicación cerrada **no está habilitada**: requiere backend de push, consentimiento y configuración adicional.
- **Créditos**: simulación de amortización de tasa fija si existe mensualidad, tasa anual y desglose del capital ya abonado. No incluye seguros, comisiones, CAT, IVA ni reajustes; confirmar contra tabla oficial de la financiera.
- **Seguridad**: tablas nuevas con RLS por usuario, migración aditiva que no modifica saldos previos, y función de importación transaccional con hash por archivo/fila y máximo de 200 movimientos.
- **Pruebas**: `node --test tests/*.test.mjs` ejecutado en GitHub Actions antes de publicar.

### Orden recomendado para probar
1. Abrir la PWA y comprobar la versión v1.5; si quedó cacheada, cerrar y volver a abrir.
2. Probar **Gastos fijos** con un ejemplo que no sea un pago real: confirmar que el total mensual aumenta y las deudas bancarias no cambian.
3. Abrir **Calendario** y comprobar próximas fechas contra bancos.
4. Crear un presupuesto de prueba y editarlo.
5. Probar importación con CSV ficticio; validar cargo, abono y exclusión de duplicados. Solo después probar con un estado real de formato conocido.
6. Revisar **Recordatorios** y comprobar permisos del navegador.
7. No usar la amortización como sustituto de una tabla bancaria o financiera oficial.
