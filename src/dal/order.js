import { db } from '../db.js';

/**
 * Find the customer's CART-status order, or create a new empty one.
 * Invariant: at most one CART-status order per customer at a time.
 * Enforce at DB level with:
 *   CREATE UNIQUE INDEX one_cart_per_customer
 *   ON orders (customer_id) WHERE status = 'CART';
 */
export async function findOrCreateCart(customerId) {
  const existing = await db.order.findFirst({
    where: { customerId, status: 'CART' },
  });
  if (existing) return existing;

  return db.order.create({
    data: {
      customerId,
      status: 'CART',
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    },
  });
}

export async function findById(id) {
  return db.order.findUnique({ where: { id } });
}

export async function updateCartContents(id, { items, subtotal, deliveryFee, total }) {
  return db.order.update({
    where: { id },
    data: { items, subtotal, deliveryFee, total },
  });
}

export async function setStatus(id, status) {
  return db.order.update({ where: { id }, data: { status } });
}

export async function listAwaitingPayment() {
  return db.order.findMany({
    where: { status: 'AWAITING_PAYMENT' },
    orderBy: { createdAt: 'desc' },
  });
}
