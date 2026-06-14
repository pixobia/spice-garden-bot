import { z } from 'zod';
import * as menuService from '../services/menu.js';
import * as orderService from '../services/order.js';
import * as customerService from '../services/customer.js';
import * as notify from '../services/notify.js';

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export async function setItemAvailability(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { isAvailable } = availabilitySchema.parse(req.body);
    const updated = await menuService.setItemAvailability(id, isAvailable);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export function refreshMenu(req, res) {
  menuService.invalidateMenuCache();
  res.json({ ok: true, message: 'Menu cache cleared; next load rebuilds from the DB.' });
}

export async function markPaid(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await orderService.markPaid(id);
    const customer = await customerService.findById(order.customerId);
    if (customer?.telegramUserId) {
      notify.notifyCustomerPaid(customer.telegramUserId, order.id).catch(() => {});
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function rejectOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await orderService.reject(id);
    const customer = await customerService.findById(order.customerId);
    if (customer?.telegramUserId) {
      notify.notifyCustomerRejected(customer.telegramUserId, order.id).catch(() => {});
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}
