import { config } from '../config.js';
import { logger } from '../logger.js';
import * as orderService from '../services/order.js';
import * as customerService from '../services/customer.js';
import * as notify from '../services/notify.js';

/**
 * Restrict a callback handler to the configured admin chat.
 */
function adminOnly(handler) {
  return async (ctx, next) => {
    if (Number(ctx.chat?.id) !== Number(config.ADMIN_CHAT_ID)) {
      logger.warn({ chatId: ctx.chat?.id }, 'Non-admin tried admin action');
      await ctx.answerCbQuery('Not authorised');
      return;
    }
    return handler(ctx, next);
  };
}

export default function registerAdmin(bot) {
  bot.action(
    /^mark_paid:(\d+)$/,
    adminOnly(async (ctx) => {
      const orderId = Number(ctx.match[1]);
      try {
        const order = await orderService.markPaid(orderId);
        const customer = await customerService.findById(order.customerId);

        if (customer?.telegramUserId) {
          await notify.notifyCustomerPaid(customer.telegramUserId, order.id);
        }

        await ctx.answerCbQuery('Marked as paid');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.reply(`Order #${orderId} marked as paid. Customer notified.`);
      } catch (err) {
        logger.error({ err, orderId }, 'Failed to mark paid');
        await ctx.answerCbQuery(err.message);
      }
    }),
  );

  bot.action(
    /^reject:(\d+)$/,
    adminOnly(async (ctx) => {
      const orderId = Number(ctx.match[1]);
      try {
        const order = await orderService.reject(orderId);
        const customer = await customerService.findById(order.customerId);

        if (customer?.telegramUserId) {
          await notify.notifyCustomerRejected(customer.telegramUserId, order.id);
        }

        await ctx.answerCbQuery('Order rejected');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.reply(`Order #${orderId} rejected. Customer notified.`);
      } catch (err) {
        logger.error({ err, orderId }, 'Failed to reject order');
        await ctx.answerCbQuery(err.message);
      }
    }),
  );
}
