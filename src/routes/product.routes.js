// HU-02 y HU-03: /api/products y /api/categories
import { Router } from 'express';
import { uploadImages } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { publishProductSchema, searchProductsSchema } from '../validators/product.schemas.js';

export function categoryRoutes({ productController }) {
  const router = Router();
  router.get('/', productController.listCategories);
  return router;
}

export function productRoutes({ productController, requireAuth }) {
  const router = Router();
  router.get('/', validate({ query: searchProductsSchema }), productController.search);
  router.get('/:id', validate({ params: idParam }), productController.getById);
  // requireAuth va antes de uploadImages: sin token no se lee ni un byte de las imágenes.
  router.post('/', requireAuth, uploadImages, validate({ body: publishProductSchema }), productController.publish);
  return router;
}
