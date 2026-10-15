// Capa de acceso a datos: usuarios. SQL parametrizado; nunca expone password_hash hacia afuera
// salvo en findByEmailWithHash, que solo usa el servicio de autenticación.
const toUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  };

export function createUserRepository(pool) {
  return {
    async findByEmailWithHash(email, db = pool) {
      const { rows } = await db.query(
        `SELECT id, name, email, phone, password_hash, created_at
           FROM users WHERE lower(email) = lower($1)`,
        [email],
      );
      return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
    },

    async existsByEmail(email, db = pool) {
      const { rowCount } = await db.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email]);
      return rowCount > 0;
    },

    async findById(id, db = pool) {
      const { rows } = await db.query(
        'SELECT id, name, email, phone, created_at FROM users WHERE id = $1',
        [id],
      );
      return toUser(rows[0]) ?? null;
    },

    async create({ name, email, passwordHash, phone }, db = pool) {
      const { rows } = await db.query(
        `INSERT INTO users (name, email, password_hash, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, created_at`,
        [name, email, passwordHash, phone],
      );
      return toUser(rows[0]);
    },
  };
}
