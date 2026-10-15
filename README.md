# Lazo — Marketplace C2C

Versión con diseño en rosa empolvado y lila: tipografías Lora y Poppins, 12 ilustraciones propias de productos y la misma API y lógica de negocio.

Aplicación web multicapa donde cada cliente registrado puede vender y comprar productos.
Cubre las historias HU-01 (registro), HU-02 (publicación), HU-03 (búsqueda y filtros) y HU-04 (compra con pasarela de pago).

| Capa | Tecnología |
| --- | --- |
| Presentación | HTML, CSS y JavaScript sin framework (`public/`) |
| Proxy inverso | Vercel Edge Network en producción; Nginx en local (`infra/nginx/`) |
| API | Node.js 22 + Express 5 (`src/routes`, `src/controllers`, `src/middlewares`) |
| Negocio | `src/services` |
| Datos e integraciones | PostgreSQL (`src/repositories`), Cloudinary y Mercado Pago (`src/integrations`) |

La arquitectura C4 está en `docs/arquitectura/` (archivos `.mmd` y `.png`). `node scripts/mermaid-links.js` imprime los enlaces para abrir cada diagrama en mermaid.ai.

## Ejecutar en local

Requisitos: Node.js 22 y PostgreSQL 16 (con la extensión `unaccent`, incluida en la distribución estándar).

```bash
npm install
cp .env.example .env            # ajusta DATABASE_URL si hace falta
createdb c2c
npm run db:migrate              # tablas, índices y categorías
npm run db:seed                 # 12 productos de demostración (cuentas valentina@ejemplo.com y camila@ejemplo.com, contraseña Demo2026!)
npm run dev                     # http://localhost:3000
```

Sin `CLOUDINARY_URL` las fotos se guardan en `uploads/`. Sin credenciales de Mercado Pago se usa la pasarela simulada: tarjeta `4242 4242 4242 4242` aprueba y `4000 0000 0000 0002` rechaza.

### Con proxy inverso (Docker)

```bash
docker compose up --build       # http://localhost:8080 (Nginx -> API -> PostgreSQL)
```

## Pruebas

```bash
createdb c2c_test
DATABASE_URL=postgres://postgres@localhost:5432/c2c_test npm run db:migrate
npm test                        # 30 pruebas de integración y unitarias
```

Usa `TEST_DATABASE_URL` si la base de pruebas está en otra dirección.

## Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel (detecta Express en `src/app.js`).
2. Instala Neon desde el Marketplace de Vercel: crea `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
3. Crea las variables `JWT_SECRET` (32+ caracteres) y `CLOUDINARY_URL`. Opcional: `PAYMENT_PROVIDER=mercadopago`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`.
4. Despliega. El build (`npm run vercel-build`) aplica la migración.
5. Verifica `https://<tu-proyecto>.vercel.app/api/health`.

## Endpoints

| Método | Ruta | HU |
| --- | --- | --- |
| POST | `/api/auth/register` | HU-01 |
| POST | `/api/auth/login` | HU-01 |
| GET | `/api/auth/me` | Sesión |
| POST | `/api/auth/logout` | Sesión |
| GET | `/api/categories` | HU-02, HU-03 |
| GET | `/api/products` | HU-03 |
| GET | `/api/products/:id` | HU-03, HU-04 |
| POST | `/api/products` | HU-02 |
| POST | `/api/orders` | HU-04 |
| GET | `/api/orders/:id` | HU-04 |
| POST | `/api/payments/webhook` | HU-04 |
| POST | `/api/payments/confirm` | HU-04 |
| POST | `/api/payments/simulated/charge` | HU-04 (sandbox) |
| GET | `/api/health` | Operación |
