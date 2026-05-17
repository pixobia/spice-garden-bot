import * as orderDal from '../dal/order.js';
import * as menuDal from '../dal/menu.js';
import { config } from '../config.js';

/**
 * Compute totals from a Mini-App-shaped items array.
 * items: [{ itemId, quantity, priceAtTime }]
 */
function computeTotals(items, deliveryFee = config.DELIVERY_FEE) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.priceAtTime, 0);
  return {
    subtotal,
    deliveryFee: items.length > 0 ? deliveryFee : 0,
    total: subtotal + (items.length > 0 ? deliveryFee : 0),
  };
}

export async function getOrCreateCart(customerId) {
  return orderDal.findOrCreateCart(customerId);
}

export async function getOrder(orderId) {
  return orderDal.findById(orderId);
}

/**
 * Upsert a single item line in the cart.
 * Setting quantity to 0 removes the line.
 */
export async function setItemQuantity(orderId, customerId, itemId, quantity) {
  const order = await orderDal.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.customerId !== customerId) throw new Error('Forbidden');
  if (order.status !== 'CART') throw new Error('Cart is locked');

  const item = await menuDal.findItemById(itemId);
  if (!item) throw new Error('Item not found');
  if (!item.isAvailable) throw new Error('Item not available');

  const items = Array.isArray(order.items) ? [...order.items] : [];
  const idx = items.findIndex((i) => i.itemId === itemId);

  if (quantity <= 0) {
    if (idx !== -1) items.splice(idx, 1);
  } else if (idx !== -1) {
    items[idx] = { ...items[idx], quantity };
  } else {
    items.push({ itemId, quantity, priceAtTime: item.price });
  }

  const totals = computeTotals(items);
  return orderDal.updateCartContents(orderId, { items, ...totals });
}

export async function removeItem(orderId, customerId, itemId) {
  return setItemQuantity(orderId, customerId, itemId, 0);
}

/**
 * CART → AWAITING_PAYMENT. Returns the updated order.
 * Caller is expected to have already verified customer details exist.
 */
export async function placeOrder(orderId, customerId) {
  const order = await orderDal.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.customerId !== customerId) throw new Error('Forbidden');
  if (order.status !== 'CART') throw new Error('Order is not in cart state');
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('Cart is empty');
  }
  return orderDal.setStatus(orderId, 'AWAITING_PAYMENT');
}

export async function markPaid(orderId) {
  const order = await orderDal.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'AWAITING_PAYMENT') {
    throw new Error(`Cannot mark paid from status ${order.status}`);
  }
  return orderDal.setStatus(orderId, 'PAID');
}

export async function reject(orderId) {
  const order = await orderDal.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'AWAITING_PAYMENT') {
    throw new Error(`Cannot reject from status ${order.status}`);
  }
  return orderDal.setStatus(orderId, 'REJECTED');
}

/**
 * Hydrate item names into an order's items array for display.
 * Returns array of { itemId, name, quantity, priceAtTime, lineTotal }.
 */
export async function hydrateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const ids = items.map((i) => i.itemId);
  const dbItems = await menuDal.findItemsByIds(ids);
  const byId = new Map(dbItems.map((i) => [i.id, i]));
  return items.map((i) => ({
    itemId: i.itemId,
    name: byId.get(i.itemId)?.name ?? `Item #${i.itemId}`,
    imageUrl: byId.get(i.itemId)?.imageUrl ?? null,
    quantity: i.quantity,
    priceAtTime: i.priceAtTime,
    lineTotal: i.quantity * i.priceAtTime,
  }));
}
