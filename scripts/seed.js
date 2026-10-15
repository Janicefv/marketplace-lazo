// Datos de demostración para la sustentación: 2 vendedores y 12 productos con imagen.
// Idempotente. Uso: npm run db:seed   (contraseña de las cuentas demo: Demo2026!)
import bcrypt from 'bcryptjs';
import pg from 'pg';

const SELLERS = [
  { name: 'Valentina Ríos', email: 'valentina@ejemplo.com', phone: '3005551010' },
  { name: 'Camila Duarte', email: 'camila@ejemplo.com', phone: '3155552020' },
];

// [vendedora, categoría, imagen, días atrás, precio, título, descripción]
const PRODUCTS = [
  [0, 'moda', 'bolso', 1, 180000, 'Bolso de mano rosa con asa y broche dorado', 'Cuero sintético, forro interno con bolsillo para el celular. Usado muy pocas veces, sin rayones.'],
  [1, 'moda', 'vestido', 2, 145000, 'Vestido lila de flores, talla S', 'Tela fresca, falda con vuelo y cinturón rosado. Perfecto para grados, matrimonios o una tarde de picnic.'],
  [0, 'moda', 'perfume', 3, 210000, 'Perfume floral de 100 ml con caja', 'Notas de rosa, peonía y vainilla. Lo usé dos veces y no es mi aroma; queda casi lleno.'],
  [1, 'hogar', 'velas', 4, 65000, 'Set de dos velas aromáticas de vainilla', 'Cera de soya en frascos de vidrio reutilizables. Más de 40 horas de duración cada una.'],
  [0, 'tecnologia', 'camara', 5, 390000, 'Cámara instantánea lila con 20 fotos', 'Imprime las fotos al momento. Incluye correa, dos paquetes de película y estuche.'],
  [1, 'hogar', 'espejo', 6, 120000, 'Espejo de tocador vintage dorado', 'Base metálica estable y marco ovalado de 40 cm. Ideal para el tocador o el escritorio.'],
  [0, 'deportes', 'bicicleta', 7, 980000, 'Bicicleta clásica con canasta, rin 26', 'Color menta, cambios de 7 velocidades y canasta delantera. Perfecta para pasear por la ciclovía.'],
  [1, 'libros', 'libros', 8, 95000, 'Lote de 4 novelas románticas', 'Ediciones en buen estado, sin subrayados. Jane Austen, Isabel Allende, Laura Esquivel y Mario Benedetti.'],
  [0, 'moda', 'tacones', 9, 160000, 'Tacones nude con moñito, talla 37', 'Tacón de 8 cm, plantilla acolchada. Los usé en un solo evento; se entregan con la caja.'],
  [1, 'tecnologia', 'audifonos', 10, 230000, 'Audífonos inalámbricos rosados con orejitas', 'Bluetooth, batería de 25 horas y luces LED en las orejas. Incluyen cable USB-C.'],
  [0, 'hogar', 'taza', 12, 45000, 'Taza de cerámica con corazones y plato', 'Capacidad de 350 ml, apta para microondas. Pintada a mano, viene en caja de regalo.'],
  [1, 'moda', 'joyero', 14, 75000, 'Joyero rosado con aretes de perlas', 'Caja con espejo interno y espacio para anillos. Incluye un par de aretes de perlas sintéticas.'],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const passwordHash = await bcrypt.hash('Demo2026!', 12);
  const sellerIds = [];
  for (const seller of SELLERS) {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, created_at)
       VALUES ($1, $2, $3, $4, now() - interval '200 days')
       ON CONFLICT ((lower(email))) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [seller.name, seller.email, passwordHash, seller.phone],
    );
    sellerIds.push(rows[0].id);
  }

  const { rowCount } = await client.query('SELECT 1 FROM products WHERE seller_id = ANY($1)', [sellerIds]);
  if (rowCount > 0) {
    console.log('[seed] Los datos de demostración ya existen.');
  } else {
    for (const [seller, slug, image, days, price, title, description] of PRODUCTS) {
      const { rows } = await client.query(
        `INSERT INTO products (seller_id, category_id, title, description, price, created_at)
         SELECT $1, id, $3, $4, $5, now() - make_interval(days => $6) FROM categories WHERE slug = $2
         RETURNING id`,
        [sellerIds[seller], slug, title, description, price, days],
      );
      await client.query(
        `INSERT INTO product_images (product_id, url, storage_key, position) VALUES ($1, $2, $3, 0)`,
        [rows[0].id, `/img/demo/${image}.jpg`, `demo/${image}`],
      );
    }
    console.log(`[seed] ${PRODUCTS.length} productos de demostración creados.`);
  }
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('[seed] Falló:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
