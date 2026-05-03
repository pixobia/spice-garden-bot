import { Markup } from 'telegraf';
import * as customerService from '../services/customer.js';
import * as orderService from '../services/order.js';
import * as notify from '../services/notify.js';
import { logger } from '../logger.js';

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
      "Welcome! Before your first order, we just need a few delivery details. Let's start with your full name.",
    );
    await ctx.scene.enter('details_wizard');
    return;
  }

  ctx.session = ctx.session || {};
  ctx.session.pendingOrderId = orderId;

  await ctx.reply(
    [
      'Please confirm your delivery details:',
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
      // Send UPI QR to user + admin DM (in parallel, best-effort).
      await Promise.all([
        notify.notifyCustomerUpiQr(customer.telegramUserId, order),
        notify.notifyAdminNewOrder(order),
      ]);
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to place order');
      await ctx.reply("Sorry, we couldn't place your order right now. Please try again in a moment.");
    }
  });

  bot.action('update_details', async (ctx) => {
    await ctx.answerCbQuery();

    const customer = await customerService.findByTelegramId(ctx.from.id);
    if (!customer) return;

    // Stash pending order so the scene can re-show the confirm prompt after.
    try {
      const cart = await orderService.getOrCreateCart(customer.id);
      if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
        ctx.session = ctx.session || {};
        ctx.session.pendingOrderId = cart.id;
      }
    } catch (err) {
      logger.warn({ err }, 'Could not stash pending order before update');
    }

    // First-timer (no saved details): full wizard collects all three fields.
    if (!customerService.hasCompleteDetails(customer)) {
      await ctx.scene.enter('details_wizard');
      return;
    }

    // Returning customer: show a picker so they can update only what changed.
    await ctx.reply(
      'What would you like to update?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Name',    'edit_field:name')],
        [Markup.button.callback('Phone',   'edit_field:phone')],
        [Markup.button.callback('Address', 'edit_field:address')],
        [Markup.button.callback('Cancel',  'edit_field:cancel')],
      ]),
    );
  });

  bot.action(/^edit_field:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const field = ctx.match[1];

    if (field === 'cancel') {
      const pendingOrderId = ctx.session?.pendingOrderId;
      if (pendingOrderId) {
        const customer = await customerService.findByTelegramId(ctx.from.id);
        if (customer && customerService.hasCompleteDetails(customer)) {
          await notify.notifyCustomerConfirmDetails(customer, pendingOrderId);
        }
      }
      return;
    }

    if (!['name', 'phone', 'address'].includes(field)) return;
    await ctx.scene.enter('field_update', { field });
  });
}
