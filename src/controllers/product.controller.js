// Capa de presentación de la API: productos (HU-02 y HU-03) y categorías.
export function createProductController({ productService }) {
  return {
    async listCategories(_req, res) {
      res.set('Cache-Control', 'public, max-age=300');
      res.json({ data: await productService.listCategories() });
    },

    async search(req, res) {
      const { items, pagination, sort } = await productService.search(req.validated.query);
      res.json({ data: items, pagination, sort });
    },

    async getById(req, res) {
      res.json({ data: await productService.getById(req.validated.params.id) });
    },

    async publish(req, res) {
      const product = await productService.publish(req.user.id, req.validated.body, req.files);
      res.status(201).location(`/api/products/${product.id}`).json({ data: product });
    },
  };
}
