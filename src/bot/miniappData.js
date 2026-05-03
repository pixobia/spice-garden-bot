import { logger } from '../logger.js';
import { sendDetailsConfirm } from './confirmDetails.js';
import { sendUpiQr } from './payment.js';

/**
 * Mini App calls Telegram.WebApp.sendData(JSON.stringify({ intent, ... })).
 * Telegram delivers it on `message.web_app_data`. We parse the intent and
 * dispatch.
 */
export default function registerMiniappData(bot) {
  bot.on('message', async (ctx, next) => {
    const data = ctx.message?.web_app_data?.data;
    if (!data) return next();

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      logger.warn({ data }, 'Mini App sent non-JSON data');
      return;
    }

    logger.info({ payload }, 'Received Mini App data');

    if (payload.intent === 'place_order') {
      // User tapped "Place Order" inside the cart Mini App.
      // Show the details confirmation prompt.
      await sendDetailsConfirm(ctx, payload.orderId);
      return;
    }

    if (payload.intent === 'placed') {
      // Server already flipped status to AWAITING_PAYMENT.
      // Send the UPI QR.
      await sendUpiQr(ctx, payload.orderId);
      return;
    }

    logger.warn({ payload }, 'Unknown Mini App intent');
  });
}
