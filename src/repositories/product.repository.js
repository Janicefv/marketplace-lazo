// Capa de acceso a datos: productos e imágenes.
// Una reserva vencida cuenta como "disponible" en cada lectura, sin escribir en la base.
const EFFECTIVE_STATUS = `CASE WHEN p.status = 'reservado' AND p.reserved_until <= now()
                              THEN 'disponible' ELSE p.status END`;
const IS_AVAILABLE = `(p.status = 'disponible' OR (p.status = 'reservado' AND p.reserved_until <= now()))`;
const COVER_URL = `(SELECT pi.url FROM product_images pi
                     WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1)`;

const toSummary = (row) => ({
  id: row.id,
  title: row.title,
  price: row.price,
  currency: 'COP',
  coverImage: row.cover_url,
  category: { slug: row.category_slug, name: row.category_name },
  createdAt: row.created_at,
});

const toProduct = (row) =>
  row && {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: 'COP',
    status: row.status,
    images: row.images,
    category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
    seller: { id: row.seller_id, name: row.seller_name, memberSince: row.seller_since },
    createdAt: row.created_at,
  };

export function createProductRepository(pool) {
  return {
    // HU-03: búsqueda con texto completo (índice GIN) y rangos de precio (índices B-tree).
    async search({ tsQuery, category, minPrice, maxPrice, sort, page, limit }, db = pool) {
      const where = [IS_AVAILABLE];
      const params = [];
      const bind = (value) => {
        params.push(value);
        return `$${params.length}`;
      };

      let queryParam = null;
      if (tsQuery) {
        queryParam = bind(tsQuery);
        where.push(`p.search_vector @@ to_tsquery('spanish', ${queryParam})`);
      }
      if (category) where.push(`c.slug = ${bind(category)}`);
      if (minPrice !== undefined) where.push(`p.price >= ${bind(minPrice)}`);
      if (maxPrice !== undefined) where.push(`p.price <= ${bind(maxPrice)}`);

      const orderBy = {
        relevancia: queryParam
          ? `ts_rank(p.search_vector, to_tsquery('spanish', ${queryParam})) DESC, p.created_at DESC`
          : 'p.created_at DESC',
        recientes: 'p.created_at DESC',
        precio_asc: 'p.price ASC, p.created_at DESC',
        precio_desc: 'p.price DESC, p.created_at DESC',
      }[sort];

      const filterSql = `FROM products p JOIN categories c ON c.id = p.category_id
                         WHERE ${where.join(' AND ')}`;
      const filterParams = [...params];
      const pageSql = `SELECT p.id, p.title, p.price, p.created_at,
                              c.slug AS category_slug, c.name AS category_name,
                              ${COVER_URL} AS cover_url
                       ${filterSql}
                       ORDER BY ${orderBy}
                       LIMIT ${bind(limit)} OFFSET ${bind((page - 1) * limit)}`;

      const [pageResult, countResult] = await Promise.all([
        db.query(pageSql, params),
        db.query(`SELECT count(*)::int AS total ${filterSql}`, filterParams),
      ]);
      return { items: pageResult.rows.map(toSummary), total: countResult.rows[0].total };
    },

    async findById(id, db = pool) {
      const { rows } = await db.query(
        `SELECT p.id, p.title, p.description, p.price, ${EFFECTIVE_STATUS} AS status, p.created_at,
                c.id AS category_id, c.slug AS category_slug, c.name AS category_name,
                u.id AS seller_id, u.name AS seller_name, u.created_at AS seller_since,
                COALESCE((SELECT json_agg(json_build_object('url', pi.url, 'position', pi.position)
                                          ORDER BY pi.position)
                            FROM product_images pi WHERE pi.product_id = p.id), '[]') AS images
           FROM products p
           JOIN categories c ON c.id = p.category_id
           JOIN users u ON u.id = p.seller_id
          WHERE p.id = $1`,
        [id],
      );
      return toProduct(rows[0]) ?? null;
    },

    // Bloquea la fila (FOR UPDATE) para que dos compras simultáneas se atiendan en serie.
    async findForPurchase(id, tx) {
      const { rows } = await tx.query(
        `SELECT id, seller_id, title, price, status,
                (status = 'reservado' AND reserved_until > now()) AS reservation_active
           FROM products WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            sellerId: row.seller_id,
            title: row.title,
            price: row.price,
            status: row.status,
            reservationActive: row.reservation_active,
          }
        : null;
    },

    async create({ sellerId, categoryId, title, description, price }, tx) {
      const { rows } = await tx.query(
        `INSERT INTO products (seller_id, category_id, title, description, price)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [sellerId, categoryId, title, description, price],
      );
      return rows[0].id;
    },

    async addImages(productId, images, tx) {
      for (const [position, image] of images.entries()) {
        await tx.query(
          `INSERT INTO product_images (product_id, url, storage_key, position)
           VALUES ($1, $2, $3, $4)`,
          [productId, image.url, image.key, position],
        );
      }
    },

    async reserve(id, minutes, tx) {
      await tx.query(
        `UPDATE products
            SET status = 'reservado', reserved_until = now() + make_interval(mins => $2), updated_at = now()
          WHERE id = $1`,
        [id, minutes],
      );
    },

    async markSold(id, tx) {
      await tx.query(
        `UPDATE products SET status = 'vendido', reserved_until = NULL, updated_at = now()
          WHERE id = $1`,
        [id],
      );
    },

    async release(id, tx) {
      await tx.query(
        `UPDATE products SET status = 'disponible', reserved_until = NULL, updated_at = now()
          WHERE id = $1 AND status = 'reservado'`,
        [id],
      );
    },
  };
}
