# Brújula Finanzas · v1.4

Aplicación personal de control de tarjetas, meses sin intereses, movimientos, estados de cuenta, efectivo y créditos. **Proyecto independiente de SUDMAR.**

## Estado actual (26 oct 2026)
- Código de la PWA incorporado a este repositorio privado (rama `main`).
- Proyecto de Supabase separado: `brujula-finanzas` (ref: `krilcvtobjzffffleebb`).
- Base de datos creada con seis tablas y reglas de seguridad a nivel fila (RLS).
- Migración `credit_opening_baseline_wizard_v14` aplicada con campos de fecha y modalidad de saldo inicial, pagos previos y fecha de crédito disponible.
- Asistente guiado de tres pasos para alta y edición de tarjetas; conserva los registros que ya existían.
- **Aún no publicada**: existe un flujo automático en `.github/workflows/pages.yml`, pero es necesario hacer públicos los archivos de código y activar GitHub Pages en la configuración antes de usar datos reales.
- Nunca introducir contraseñas bancarias, número completo de tarjeta, NIP ni CVV.

## Archivos
- `index.html`, `app.js`, `styles.css`: interfaz de usuario.
- `config.js`: URL y **clave publicable** del proyecto Supabase (no es una clave secreta).
- `manifest.webmanifest`, `sw.js`, iconos: instalación como aplicación web (PWA).
- `schema.sql`, `migrate_v1_1.sql`: referencias históricas de esquema. **No volver a ejecutarlos en Supabase**, la base ya está creada.

## Publicación
Una cuenta GitHub Free solo permite GitHub Pages desde repositorios **públicos**. Para conservar este repositorio **privado**, usar GitHub Pro/Team o un hosting estático externo compatible con repositorios privados. En ambos casos, el sitio web de inicio de sesión puede ser público; la privacidad de los datos depende de Supabase Auth + RLS.

Se incorporó el flujo de GitHub Actions `.github/workflows/pages.yml`, que publica **solo** HTML, CSS, JS, manifiesto e iconos (no publica SQL ni documentación). Para habilitarlo por primera vez con GitHub Free: 1) `Settings > General > Danger Zone > Change repository visibility > Public`; 2) `Settings > Pages > Build and deployment > Source > GitHub Actions`; 3) abrir `Actions > Publicar Brújula Finanzas > Run workflow` (rama `main`). El sitio esperado, una vez confirmado el despliegue, es `https://javi-jim2026.github.io/brujula-finanzas/`. No compartir ni dar por activo ese enlace hasta verificar el despliegue. **No registrar datos bancarios reales antes de probar autenticación y aislamiento**.

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
