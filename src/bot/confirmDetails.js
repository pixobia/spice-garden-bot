import { Markup } from 'telegraf';
import * as customerService from '../services/customer.js';
import * as orderService from '../services/order.js';
import * as upiService from '../services/upi.js';
import * as notify from '../services/notify.js';
import { logger } from '../logger.js';
import { sendUpiQr } from './payment.js';

/**
 * Show the user their saved details and ask to confirm or update before payment.
 */
export async function sendDetailsConfirm(ctx, orderId) {
  const customer = await customerService.findByTelegramId(ctx.from.id);

  if (!customerService.hasCompleteDetails(customer)) {
    // Send into the wizard. Stash the orderId so the wizard knows what to do after.
    ctx.session = ctx.session || {};
    ctx.session.pendingOrderId = orderId;
    await ctx.reply(
      "Looks like this is your first order — we just need a few details. Let's start with your full name.",
    );
    await ctx.scene.enter('details_wizard');
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.pendingOrderId = orderId;

  await ctx.reply(
    [
      'Almost done! Please confirm your delivery details:',
      '',
      `Name:     ${customer.name}`,
      `Phone:    ${customer.phone}`,
      `Address:  ${customer.address}`,
    ].join('\n'),
    Markup.inlineKeyboard([
      [Markup.button.callback('Confirm and pay', `confirm_pay:${orderId}`)],
      [Markup.button.callback('Update details', 'update_details')],
    ]),
  );
}

export default function registerConfirmDetails(bot) {
  bot.action(/^confirm_pay:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const orderId = Number(ctx.match[1]);
    const customer = await customerService.findByTelegramId(ctx.from.id);

    try {
      const order = await orderService.placeOrder(orderId, customer.id);
      // Fire admin DM (best-effort)
      notify.notifyAdminNewOrder(order).catch(() => {});
      await sendUpiQr(ctx, orderId);
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to place order');
      await ctx.reply(`Couldn't place the order: ${err.message}`);
    }
  });

  bot.action('update_details', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('details_wizard');
  });
}
