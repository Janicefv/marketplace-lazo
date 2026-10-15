// Aplica src/db/schema.sql. Es idempotente y usa un candado para que dos despliegues
// simultáneos no migren a la vez. Uso: npm run db:migrate
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const ifConfigured = process.argv.includes('--if-configured');
// En Neon, DATABASE_URL pasa por PgBouncer; el candado de sesión necesita la conexión directa.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  if (ifConfigured) {
    console.log('[migrate] DATABASE_URL no está definida: se omite la migración.');
    process.exit(0);
  }
  console.error('[migrate] Define DATABASE_URL antes de migrar.');
  process.exit(1);
}

const sql = await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(727272)');
  await client.query(sql);
  console.log('[migrate] Esquema aplicado correctamente.');
} catch (err) {
  console.error('[migrate] Falló la migración:', err.message);
  process.exitCode = 1;
} finally {
  await client.query('SELECT pg_advisory_unlock(727272)').catch(() => {});
  await client.end();
}
