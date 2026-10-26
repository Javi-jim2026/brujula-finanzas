# Brújula Finanzas · v1.3

Aplicación personal de control de tarjetas, meses sin intereses, movimientos, estados de cuenta, efectivo y créditos. **Proyecto independiente de SUDMAR.**

## Estado actual (26 oct 2026)
- Código de la PWA incorporado a este repositorio privado (rama `main`).
- Proyecto de Supabase separado: `brujula-finanzas` (ref: `krilcvtobjzffffleebb`).
- Base de datos creada con seis tablas y reglas de seguridad a nivel fila (RLS).
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
