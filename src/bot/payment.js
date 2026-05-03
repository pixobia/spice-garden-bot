import * as orderService from '../services/order.js';
import * as upiService from '../services/upi.js';
import { logger } from '../logger.js';

const fmtINR = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * Generate the UPI QR for an order and send it to the user.
 */
export async function sendUpiQr(ctx, orderId) {
  const order = await orderService.getOrder(orderId);
  if (!order) {
    await ctx.reply("Couldn't find that order. Please try again.");
    return;
  }

  const uri = upiService.buildUri({ orderId: order.id, amountPaise: order.total });
  const ref = upiService.buildRef(order.id);
  const qrPng = await upiService.generateQrPng(uri);

  await ctx.reply(`Order received  ·  ${fmtINR(order.total)}`);
  await ctx.replyWithPhoto(
    { source: qrPng },
    {
      caption: `Scan with any UPI app to pay.\nAmount and reference (${ref}) are pre-filled.`,
    },
  );
  await ctx.reply('Once you have paid, please wait — we will confirm shortly.');

  logger.info({ orderId, total: order.total }, 'Sent UPI QR to customer');
}

export default function registerPayment(_bot) {
  // No bot.action handlers here — payment.sendUpiQr is invoked from
  // confirmDetails.js (after the user taps "Confirm and pay") and
  // miniappData.js (if the Mini App calls it directly).
}
