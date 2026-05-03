import * as menuService from './menu.js';
import * as orderService from './order.js';
import * as customerService from './customer.js';
import { config } from '../config.js';

/**
 * Bundled response for Mini App first paint.
 * Returns: { customer, menu, cart }
 */
export async function getInitData(telegramUserId) {
  const customer = await customerService.findOrCreate(telegramUserId);
  const [menu, cart] = await Promise.all([
    menuService.getMenu(),
    orderService.getOrCreateCart(customer.id),
  ]);

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      hasCompleteDetails: customerService.hasCompleteDetails(customer),
    },
    menu,
    cart: {
      id: cart.id,
      status: cart.status,
      items: cart.items,
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
    },
    deliveryFeePaise: config.DELIVERY_FEE_PAISE,
  };
}
