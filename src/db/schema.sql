-- Marketplace C2C — esquema PostgreSQL 16 (idempotente: se puede ejecutar varias veces)

-- Búsqueda sin tildes: "cafe" encuentra "café".
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- HU-01: usuarios -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,             -- bcrypt, nunca la contraseña
  phone         VARCHAR(20)  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Unicidad del correo sin importar mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

-- HU-02 / HU-03: catálogo -------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id   SMALLSERIAL PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    SMALLINT    NOT NULL REFERENCES categories(id),
  title          VARCHAR(120) NOT NULL,
  description    TEXT        NOT NULL,
  price          INTEGER     NOT NULL CHECK (price BETWEEN 1 AND 1000000000), -- pesos colombianos
  status         VARCHAR(12) NOT NULL DEFAULT 'disponible'
                 CHECK (status IN ('disponible', 'reservado', 'vendido')),
  reserved_until TIMESTAMPTZ,
  search_vector  TSVECTOR GENERATED ALWAYS AS (
                   setweight(to_tsvector('spanish', immutable_unaccent(title)), 'A') ||
                   setweight(to_tsvector('spanish', immutable_unaccent(description)), 'B')
                 ) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de HU-03: texto completo (GIN) y rangos de precio por estado/categoría (B-tree).
CREATE INDEX IF NOT EXISTS products_search_idx            ON products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS products_status_price_idx      ON products (status, price);
CREATE INDEX IF NOT EXISTS products_cat_status_price_idx  ON products (category_id, status, price);
CREATE INDEX IF NOT EXISTS products_status_created_idx    ON products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_seller_idx            ON products (seller_id);
CREATE INDEX IF NOT EXISTS products_reserved_until_idx    ON products (reserved_until) WHERE status = 'reservado';

CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT     NOT NULL,
  storage_key TEXT     NOT NULL,
  position    SMALLINT NOT NULL,
  UNIQUE (product_id, position)
);

-- HU-04: órdenes -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID        NOT NULL REFERENCES products(id),
  buyer_id          UUID        NOT NULL REFERENCES users(id),
  seller_id         UUID        NOT NULL REFERENCES users(id),
  amount            INTEGER     NOT NULL CHECK (amount > 0),
  currency          CHAR(3)     NOT NULL DEFAULT 'COP',
  status            VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente', 'pagada', 'rechazada', 'expirada', 'cancelada')),
  payment_method    VARCHAR(12) NOT NULL CHECK (payment_method IN ('tarjeta', 'pse')),
  payment_provider  VARCHAR(20) NOT NULL,
  checkout_ref      TEXT,                      -- id de la preferencia/sesión en la pasarela
  payment_ref       TEXT,                      -- id del pago aprobado o rechazado
  refund_required   BOOLEAN     NOT NULL DEFAULT false,
  shipping_address  JSONB       NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_buyer_is_not_seller CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS orders_buyer_idx  ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON orders (seller_id, created_at DESC);
-- Defensa en profundidad contra compras duplicadas: a lo sumo una orden pendiente
-- y una orden pagada por producto, garantizado por la base de datos.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_pending_per_product ON orders (product_id) WHERE status = 'pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_paid_per_product    ON orders (product_id) WHERE status = 'pagada';
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_ref_unique      ON orders (payment_provider, payment_ref) WHERE payment_ref IS NOT NULL;

-- Datos de referencia ----------------------------------------------------
INSERT INTO categories (slug, name) VALUES
  ('tecnologia', 'Tecnología'),
  ('hogar',      'Hogar y muebles'),
  ('moda',       'Moda y accesorios'),
  ('deportes',   'Deportes y bicicletas'),
  ('libros',     'Libros y música'),
  ('vehiculos',  'Vehículos y repuestos'),
  ('bebes',      'Bebés y juguetes'),
  ('otros',      'Otros')
ON CONFLICT (slug) DO NOTHING;
