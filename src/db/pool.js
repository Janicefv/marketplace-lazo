// Capa de datos: pool de conexiones PostgreSQL y ayudante de transacciones.
import pg from 'pg';

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    // En funciones serverless conviene un pool pequeño y conexiones que se cierran rápido.
    max: config.isVercel ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => {
    console.error('[db] Error en una conexión inactiva:', err.message);
  });
  return pool;
}

// Ejecuta fn dentro de BEGIN/COMMIT; ante cualquier error hace ROLLBACK.
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
