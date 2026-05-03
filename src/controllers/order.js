import { z } from 'zod';
import * as orderService from '../services/order.js';
import * as customerService from '../services/customer.js';
import * as upiService from '../services/upi.js';
import * as notify from '../services/notify.js';

const itemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).max(99),
});

export async function getOrCreateCart(req, res, next) {
  try {
    const cart = await orderService.getOrCreateCart(req.customer.id);
    res.json(cart);
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    if (order.customerId !== req.customer.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function setItemQuantity(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { itemId, quantity } = itemSchema.parse(req.body);
    const updated = await orderService.setItemQuantity(id, req.customer.id, itemId, quantity);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const updated = await orderService.removeItem(id, req.customer.id, itemId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Place the order: CART → AWAITING_PAYMENT, return UPI URI for the QR.
 * Also fires the admin DM as a side effect (best-effort).
 */
export async function placeOrder(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Customer details must exist before placing.
    const customer = await customerService.findById(req.customer.id);
    if (!customerService.hasCompleteDetails(customer)) {
      return res.status(409).json({ error: 'details_required' });
    }

    const order = await orderService.placeOrder(id, req.customer.id);
    const upiUri = upiService.buildUri({ orderId: order.id, amountPaise: order.total });
    const ref = upiService.buildRef(order.id);

    // Fire-and-forget admin notification
    notify.notifyAdminNewOrder(order).catch(() => {});

    res.json({
      order,
      upiUri,
      ref,
      amountPaise: order.total,
    });
  } catch (err) {
    next(err);
  }
}
