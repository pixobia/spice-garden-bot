import { Markup } from 'telegraf';
import { bot } from '../bot/bot.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import * as orderService from './order.js';
import * as customerService from './customer.js';

const fmtINR = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * DM the admin when a new order moves to AWAITING_PAYMENT.
 * Buttons let the admin confirm or reject in one tap.
 */
export async function notifyAdminNewOrder(order) {
  const customer = await customerService.findById(order.customerId);
  const lines = await orderService.hydrateItems(order.items);

  const itemLines = lines.map(
    (l) => `• ${l.name} × ${l.quantity}     ${fmtINR(l.lineTotal)}`,
  );

  const text = [
    `New order  ·  #${order.id}`,
    '',
    `Customer:  ${customer?.name ?? '(unknown)'}`,
    `Phone:     ${customer?.phone ?? '-'}`,
    `Address:   ${customer?.address ?? '-'}`,
    '',
    'Items:',
    ...itemLines,
    '',
    `Subtotal: ${fmtINR(order.subtotal)}`,
    `Delivery: ${fmtINR(order.deliveryFee)}`,
    `Total:    ${fmtINR(order.total)}`,
    '',
    `UPI ref: Order-${order.id}`,
  ].join('\n');

  try {
    await bot.telegram.sendMessage(
      config.ADMIN_CHAT_ID,
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('Order placed successfully', `mark_paid:${order.id}`)],
        [Markup.button.callback('Reject order', `reject:${order.id}`)],
      ]),
    );
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Failed to notify admin');
  }
}

export async function notifyCustomerPaid(telegramUserId, orderId) {
  const text = [
    'Payment confirmed!',
    '',
    `Order #${orderId} is being prepared. Please wait 15–30 minutes for delivery.`,
    '',
    'Thank you for ordering with Spice Garden.',
  ].join('\n');
  try {
    await bot.telegram.sendMessage(Number(telegramUserId), text);
  } catch (err) {
    logger.error({ err, telegramUserId, orderId }, 'Failed to notify customer paid');
  }
}

export async function notifyCustomerRejected(telegramUserId, orderId) {
  const text = [
    `Sorry — your order #${orderId} has been cancelled.`,
    '',
    'If you completed the payment, please contact us and we will refund you shortly.',
  ].join('\n');
  try {
    await bot.telegram.sendMessage(Number(telegramUserId), text);
  } catch (err) {
    logger.error({ err, telegramUserId, orderId }, 'Failed to notify customer rejected');
  }
}
