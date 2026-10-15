// Capa de acceso a datos: órdenes de compra (HU-04).
// Una orden pendiente cuyo plazo venció se lee como "expirada" sin escribir en la base.
const ORDER_SELECT = `
  SELECT o.id,
         CASE WHEN o.status = 'pendiente' AND o.expires_at <= now() THEN 'expirada' ELSE o.status END AS status,
         o.amount, o.currency, o.payment_method, o.payment_provider, o.checkout_ref, o.payment_ref,
         o.refund_required, o.shipping_address, o.expires_at, o.paid_at, o.created_at,
         o.product_id, p.title AS product_title,
         (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1) AS product_cover,
         o.buyer_id, b.name AS buyer_name, o.seller_id, s.name AS seller_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN users b ON b.id = o.buyer_id
    JOIN users s ON s.id = o.seller_id`;

const toOrder = (row) =>
  row && {
    id: row.id,
    status: row.status,
    amount: row.amount,
    currency: row.currency.trim(),
    paymentMethod: row.payment_method,
    paymentProvider: row.payment_provider,
    checkoutRef: row.checkout_ref,
    paymentRef: row.payment_ref,
    refundRequired: row.refund_required,
    shippingAddress: row.shipping_address,
    product: { id: row.product_id, title: row.product_title, coverImage: row.product_cover },
    buyer: { id: row.buyer_id, name: row.buyer_name },
    seller: { id: row.seller_id, name: row.seller_name },
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };

export function createOrderRepository(pool) {
  return {
    async findById(id, db = pool) {
      const { rows } = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
      return toOrder(rows[0]) ?? null;
    },

    // Fila cruda y bloqueada: la usa el servicio de pagos para aplicar un resultado una sola vez.
    async findForPayment(id, tx) {
      const { rows } = await tx.query(
        `SELECT id, product_id, buyer_id, status, amount, currency, payment_method,
                (expires_at <= now()) AS is_expired
           FROM orders WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            productId: row.product_id,
            buyerId: row.buyer_id,
            status: row.status,
            amount: row.amount,
            currency: row.currency.trim(),
            paymentMethod: row.payment_method,
            isExpired: row.is_expired,
          }
        : null;
    },

    async create(order, tx) {
      const { rows } = await tx.query(
        `INSERT INTO orders (product_id, buyer_id, seller_id, amount, payment_method,
                             payment_provider, shipping_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))
         RETURNING id`,
        [
          order.productId,
          order.buyerId,
          order.sellerId,
          order.amount,
          order.paymentMethod,
          order.paymentProvider,
          order.shippingAddress,
          order.reservationMinutes,
        ],
      );
      return rows[0].id;
    },

    async expirePendingForProduct(productId, tx) {
      await tx.query(
        `UPDATE orders SET status = 'expirada', updated_at = now()
          WHERE product_id = $1 AND status = 'pendiente'`,
        [productId],
      );
    },

    async hasOtherActivePending(productId, orderId, tx) {
      const { rowCount } = await tx.query(
        `SELECT 1 FROM orders
          WHERE product_id = $1 AND id <> $2 AND status = 'pendiente' AND expires_at > now()`,
        [productId, orderId],
      );
      return rowCount > 0;
    },

    async attachCheckout(id, checkoutRef, db = pool) {
      await db.query('UPDATE orders SET checkout_ref = $2, updated_at = now() WHERE id = $1', [id, checkoutRef]);
    },

    async markPaid(id, paymentRef, tx) {
      await tx.query(
        `UPDATE orders SET status = 'pagada', payment_ref = $2, paid_at = now(), updated_at = now()
          WHERE id = $1`,
        [id, paymentRef],
      );
    },

    async markRejected(id, paymentRef, { refundRequired = false } = {}, tx) {
      await tx.query(
        `UPDATE orders SET status = 'rechazada', payment_ref = COALESCE($2, payment_ref),
                           refund_required = $3, updated_at = now()
          WHERE id = $1`,
        [id, paymentRef, refundRequired],
      );
    },

    async markCancelled(id, tx) {
      await tx.query(
        `UPDATE orders SET status = 'cancelada', updated_at = now() WHERE id = $1 AND status = 'pendiente'`,
        [id],
      );
    },
  };
}
