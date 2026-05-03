import { z } from 'zod';
import * as orderService from '../services/order.js';
import * as customerService from '../services/customer.js';
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
 * Place an order. The cart stays in CART until the user explicitly confirms
 * — we don't flip the status here.
 *
 *   - No saved details: DM "Add my details" → wizard → wizard places the order.
 *   - Has saved details: DM their saved details with [Confirm and pay] /
 *     [Update details]. The bot's confirm_pay handler does the actual placing
 *     (and sends the UPI QR + admin DM) when the user taps Confirm.
 */
export async function placeOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await customerService.findById(req.customer.id);

    if (!customerService.hasCompleteDetails(customer)) {
      notify.notifyCustomerDetailsRequired(customer.telegramUserId).catch(() => {});
      return res.json({ status: 'details_required', orderId: id });
    }

    notify.notifyCustomerConfirmDetails(customer, id).catch(() => {});
    res.json({ status: 'awaiting_confirmation', orderId: id });
  } catch (err) {
    next(err);
  }
}
