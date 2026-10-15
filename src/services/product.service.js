// Capa de negocio: publicación (HU-02) y búsqueda (HU-03) de productos.
import { withTransaction } from '../db/pool.js';
import { NotFoundError, UnprocessableError } from '../utils/errors.js';

// "bici roja" -> "bici:* & roja:*": coincide por prefijo, sin tildes y con raíces en español.
export function toPrefixTsQuery(text) {
  if (!text) return null;
  const terms = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((term) => `${term}:*`).join(' & ') : null;
}

export function createProductService({ pool, productRepository, categoryRepository, storage }) {
  return {
    async publish(sellerId, data, files) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category) {
        throw UnprocessableError('UNKNOWN_CATEGORY', 'La categoría seleccionada no existe.', [
          { field: 'categoryId', message: 'Selecciona una categoría válida.' },
        ]);
      }

      // Sube todas las imágenes; si alguna falla, borra las que sí subieron.
      const results = await Promise.allSettled(
        files.map((file) => storage.upload(file.buffer, { contentType: file.detectedType, folder: 'products' })),
      );
      const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      const failure = results.find((r) => r.status === 'rejected');
      if (failure) {
        await Promise.allSettled(uploaded.map((image) => storage.remove(image.key)));
        throw failure.reason;
      }

      try {
        const productId = await withTransaction(pool, async (tx) => {
          const id = await productRepository.create({ sellerId, ...data }, tx);
          await productRepository.addImages(id, uploaded, tx);
          return id;
        });
        return productRepository.findById(productId);
      } catch (err) {
        await Promise.allSettled(uploaded.map((image) => storage.remove(image.key)));
        throw err;
      }
    },

    async search(filters) {
      const tsQuery = toPrefixTsQuery(filters.search);
      const sort = filters.sort ?? (tsQuery ? 'relevancia' : 'recientes');
      const { items, total } = await productRepository.search({ ...filters, tsQuery, sort });
      return {
        items,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
        sort,
      };
    },

    listCategories() {
      return categoryRepository.list();
    },

    async getById(id) {
      const product = await productRepository.findById(id);
      if (!product) throw NotFoundError('PRODUCT_NOT_FOUND', 'El producto no existe.');
      return product;
    },
  };
}
