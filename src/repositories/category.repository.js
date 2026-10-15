// Capa de acceso a datos: categorías (datos de referencia).
const toCategory = (row) => row && { id: row.id, slug: row.slug, name: row.name };

export function createCategoryRepository(pool) {
  return {
    async list(db = pool) {
      const { rows } = await db.query('SELECT id, slug, name FROM categories ORDER BY id');
      return rows.map(toCategory);
    },

    async findById(id, db = pool) {
      const { rows } = await db.query('SELECT id, slug, name FROM categories WHERE id = $1', [id]);
      return toCategory(rows[0]) ?? null;
    },
  };
}
