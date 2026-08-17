# Lúmina — prototipo de tienda online

Aplicación full-stack de una tienda editorial en español. Incluye catálogo,
filtros, búsqueda, cesta persistente, diseño responsive y una API local
conectada a MySQL.

## Funcionalidades

- Catálogo con búsqueda, filtros y páginas individuales de producto.
- Cesta persistente y checkout con validación de stock.
- Creación transaccional de pedidos y descuento automático de inventario.
- Registro e inicio de sesión de clientes con historial y estado de pedidos.
- Perfil editable con nombre, teléfono y preferencias de comunicación.
- Favoritos, libreta de direcciones y reutilización del perfil en checkout.
- Cambio de contraseña y cancelación de pedidos pendientes con reposición de stock.
- Detalle individual de pedido con cronología, entrega, importes y seguimiento.
- Vista operativa de pedido para administración con actualización segura de estado.
- Sesiones protegidas mediante cookies `HttpOnly` y contraseñas con hash `scrypt`.
- Panel administrativo para productos, stock, clientes, estados de pedido y subida de imágenes.
- Ficha individual de cliente con métricas, actividad, direcciones, favoritos y pedidos filtrables.
- Bloqueo y reactivación de cuentas con cierre inmediato de todas sus sesiones.
- Búsqueda, filtros por fechas/estado/inventario y paginación desde MySQL.
- Indicadores de stock, restauración de productos y ranking de ventas global.
- Confirmaciones integradas en la interfaz para operaciones sensibles.
- Imágenes locales JPEG, PNG o WebP con validación de firma y límite de 5 MB.
- Metadatos sociales y SEO específicos para cada producto.
- Interfaz responsive y estados de error, carga y confirmación.

## Puesta en marcha

Requisitos: Node.js 22 o superior y MySQL 8.

1. Crea la base de datos y carga los productos de ejemplo:

   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. Si actualizas una instalación existente, aplica también las migraciones:

   ```bash
   mysql -u root -p < database/migrations/002_checkout.sql
   mysql -u root -p < database/migrations/003_accounts.sql
   mysql -u root -p < database/migrations/004_customer_features.sql
   mysql -u root -p < database/migrations/005_order_tracking.sql
   mysql -u root -p < database/migrations/006_customer_profiles.sql
   ```

3. Copia `.env.example` como `.env`, ajusta MySQL y configura
   `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

4. Prepara la cuenta de demostración y sus pedidos representativos:

   ```bash
   npm run db:seed-demo
   ```

5. Arranca la API en una terminal:

   ```bash
   npm run api
   ```

6. Arranca la tienda en otra terminal:

   ```bash
   npm run dev
   ```

La tienda queda en `http://localhost:3000` y la API en `http://localhost:3001`.
Si MySQL o la API no están activos, el escaparate usa automáticamente los datos
de demostración para que el escaparate siga siendo navegable.

En Visual Studio Code también puedes pulsar `Ctrl + Shift + B` para iniciar la
tienda y la API conjuntamente con la versión correcta de Node incluida en
Laragon.

## Rutas principales

- `/`: escaparate y catálogo.
- `/productos/[slug]`: ficha individual con metadatos propios.
- `/checkout`: creación de pedidos.
- `/cuenta`: perfil, acceso, pedidos, favoritos, direcciones y seguridad de la cuenta.
- `/cuenta/pedidos/[id]`: contenido, cronología y seguimiento de un pedido propio.
- `/admin`: gestión del catálogo, pedidos y clientes. La cuenta inicial se
  configura con `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env`.
- `/admin/pedidos/[id]`: detalle operativo, estado, stock y seguimiento.
- `/admin/clientes/[id]`: ficha, actividad, pedidos y estado de una cuenta de cliente.

## Cuenta de demostración

- Correo: `cliente@lumina.local`
- Contraseña: `lumina-cliente-2026`

El generador es idempotente por estado: conserva los pedidos existentes y solo
añade los ejemplos pendiente, preparando o enviado que falten.

## Archivos subidos

Las imágenes cargadas desde administración se guardan en
`storage/product-images`. El contenido de esa carpeta se excluye de Git: en un
entorno publicado debe sustituirse por almacenamiento de objetos persistente.

## Siguiente iteración sugerida

Auditoría de seguridad completa, recuperación de contraseña y verificación de
correo mediante un proveedor de email, pasarela de pago y una suite de pruebas
de navegador. Si el proyecto se publica, la arquitectura permite migrar en una
iteración independiente de MySQL local a PostgreSQL, Auth y Storage de Supabase.
