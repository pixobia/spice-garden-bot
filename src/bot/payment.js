import * as orderService from "../services/order.js";
import * as upiService from "../services/upi.js";
import { logger } from "../logger.js";

const fmtINR = (paise) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/**
 * Generate the UPI QR for an order and send it to the user.
 */
export async function sendUpiQr(ctx, orderId) {
  const order = await orderService.getOrder(orderId);
  if (!order) {
    await ctx.reply("We couldn't find that order. Please start a new one.");
    return;
  }

  const uri = upiService.buildUri({
    orderId: order.id,
    amountPaise: order.total,
  });
  const ref = upiService.buildRef(order.id);
  const qrPng = await upiService.generateQrPng(uri);

  await ctx.reply(`Order received  ·  ${fmtINR(order.total)}`);
  await ctx.replyWithPhoto(
    { source: qrPng },
    {
      caption: `Scan this QR with any UPI app to pay ${fmtINR(
        order.total
      )}.\nReference: ${ref}`,
    }
  );
  await ctx.reply(
    "Once you've paid, please sit tight — we'll confirm your order shortly."
  );

  logger.info({ orderId, total: order.total }, "Sent UPI QR to customer");
}
