import { Markup } from "telegraf";
import { bot } from "../bot/bot.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import * as orderService from "./order.js";
import * as customerService from "./customer.js";
import * as upiService from "./upi.js";

const fmtINR = (rupees) => `₹${rupees.toLocaleString("en-IN")}`;

// Render's free tier occasionally drops the outbound connection to Telegram
// mid-request (ECONNRESET / socket hang up). Retry transient transport-level
// failures a few times before giving up.
const TRANSIENT = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);
async function withRetry(fn, label, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = TRANSIENT.has(err?.code) || err?.name === "FetchError";
      if (!transient || i === attempts) throw err;
      logger.warn({ err: err?.message, attempt: i, label }, "Transient send error — retrying");
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

/**
 * DM the admin when a new order moves to AWAITING_PAYMENT.
 * Buttons let the admin confirm or reject in one tap.
 */
export async function notifyAdminNewOrder(order) {
  const customer = await customerService.findById(order.customerId);
  const lines = await orderService.hydrateItems(order.items);

  const itemLines = lines.map(
    (l) => `• ${l.name} × ${l.quantity} = ${fmtINR(l.lineTotal)}`
  );

  const text = [
    `New order  ·  #${order.id}`,
    "",
    `Customer:  ${customer?.name ?? "(unknown)"}`,
    `Phone:     ${customer?.phone ?? "-"}`,
    `Address:   ${customer?.address ?? "-"}`,
    "",
    "Items:",
    ...itemLines,
    "",
    `Subtotal: ${fmtINR(order.subtotal)}`,
    `Delivery: ${order.deliveryFee === 0 ? 'Free' : fmtINR(order.deliveryFee)}`,
    `Total:    ${fmtINR(order.total)}`,
    "",
    `UPI ref: Order-${order.id}`,
  ].join("\n");

  try {
    await bot.telegram.sendMessage(
      config.ADMIN_CHAT_ID,
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "Order placed successfully",
            `mark_paid:${order.id}`
          ),
        ],
        [Markup.button.callback("Reject order", `reject:${order.id}`)],
      ])
    );
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to notify admin");
  }
}

export async function notifyCustomerPaid(telegramUserId, orderId) {
  const text = [
    "Payment received — thank you!",
    "",
    `Your order #${orderId} is being prepared. Expected delivery in 15–30 minutes.`,
    "",
    "Thanks for ordering with Crust & Fuel.",
  ].join("\n");
  try {
    await bot.telegram.sendMessage(Number(telegramUserId), text);
  } catch (err) {
    logger.error(
      { err, telegramUserId, orderId },
      "Failed to notify customer paid"
    );
  }
}

export async function notifyCustomerRejected(telegramUserId, orderId) {
  const text = [
    `Sorry, your order #${orderId} couldn't be confirmed and has been cancelled.`,
    "",
    `If you've already paid, please contact us at ${config.ADMIN_MOBILE_NUMBER} — we'll process your refund right away.`,
  ].join("\n");
  try {
    await bot.telegram.sendMessage(Number(telegramUserId), text);
  } catch (err) {
    logger.error(
      { err, telegramUserId, orderId },
      "Failed to notify customer rejected"
    );
  }
}

/**
 * DM the user a UPI QR with a "Pay with UPI app" button after order placement.
 *
 * Implementation note — why we pass a URL instead of a Buffer:
 * We used to call `sendPhoto(chatId, { source: qrPng }, ...)` which streams
 * the PNG bytes to api.telegram.org as multipart/form-data. On Render's free
 * tier, that long-lived upload consistently failed with "socket hang up" —
 * even though small JSON POSTs (sendMessage, etc.) from the same pod worked
 * fine. Switching to URL mode means our outbound payload to Telegram is now
 * a tiny JSON body; Telegram's CDN fetches the PNG from /qr/:id.png on its
 * own. No more flaky multipart upload, no more ECONNRESET retries.
 */
export async function notifyCustomerUpiQr(telegramUserId, order) {
  // Single try/catch around the whole function so NO error can escape and
  // poison the Promise.allSettled in the bot handler. On any failure we still
  // log a structured error and DM the user a plain-text fallback so they
  // aren't left wondering what happened.
  try {
    if (!order || typeof order.total !== "number") {
      throw new Error(
        `Bad order passed to notifyCustomerUpiQr: total=${order?.total}`,
      );
    }
    const chatId = Number(telegramUserId);
    const ref = upiService.buildRef(order.id);
    const payUrl = `${config.PUBLIC_URL}/pay/${order.id}`;
    const qrUrl = `${config.PUBLIC_URL}/qr/${order.id}.png`;

    // Telegram requires HTTPS for both URL buttons AND URL-fetched photos.
    // If PUBLIC_URL is mis-configured we can't usefully recover — log and
    // fall through to the plain-text fallback below.
    if (!/^https:\/\/[^/]+/.test(config.PUBLIC_URL)) {
      throw new Error(
        `PUBLIC_URL must be https://… got ${config.PUBLIC_URL}`,
      );
    }

    const photoOpts = {
      caption: `Order #${order.id}  ·  ${fmtINR(order.total)}\nTap "Pay with UPI app" below, or scan the QR above.`,
      ...Markup.inlineKeyboard([
        [Markup.button.url("Pay with UPI app", payUrl)],
      ]),
    };

    // Pass the URL string — Telegram fetches the PNG from /qr/:id.png. This
    // replaces the previous `{ source: buffer }` upload (see header comment).
    await withRetry(
      () => bot.telegram.sendPhoto(chatId, qrUrl, photoOpts),
      "sendPhoto-qr",
    );

    await withRetry(
      () =>
        bot.telegram.sendMessage(
          chatId,
          `We'll confirm once your payment is received.  ·  Reference: ${ref}`,
        ),
      "sendMessage-qr-followup",
    );

    logger.info(
      { orderId: order.id, telegramUserId, total: order.total, qrUrl },
      "Sent UPI QR",
    );
  } catch (err) {
    logger.error(
      {
        err: err?.response || err?.message || String(err),
        stack: err?.stack,
        orderId: order?.id,
        telegramUserId,
        total: order?.total,
        publicUrl: config.PUBLIC_URL,
      },
      "Failed to send UPI QR to customer",
    );
    // Last-resort plain-text fallback so the customer always gets *something*.
    try {
      await bot.telegram.sendMessage(
        Number(telegramUserId),
        `Order received  ·  ${fmtINR(order?.total ?? 0)}\n\nWe're generating your UPI QR — if it doesn't arrive in a moment, please reach out and we'll send a payment link manually.`,
      );
    } catch {}
  }
}

/**
 * Returning customer placed an order — show their saved details so they
 * can confirm or update before paying. The bot's confirm_pay / update_details
 * callbacks (registered in bot/confirmDetails.js) handle the taps.
 */
export async function notifyCustomerConfirmDetails(customer, orderId) {
  const text = [
    "Almost done! Please confirm your delivery details:",
    "",
    `Name:     ${customer.name}`,
    `Phone:    ${customer.phone}`,
    `Address:  ${customer.address}`,
  ].join("\n");

  try {
    await bot.telegram.sendMessage(
      Number(customer.telegramUserId),
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("Confirm and pay", `confirm_pay:${orderId}`)],
        [Markup.button.callback("Update details", "update_details")],
      ])
    );
  } catch (err) {
    logger.error(
      { err, customerId: customer.id, orderId },
      "Failed to send confirm-details DM"
    );
  }
}

/**
 * If a user tries to Place Order without saved details, DM them a button
 * that drops them straight into the details wizard.
 */
export async function notifyCustomerDetailsRequired(telegramUserId) {
  try {
    await bot.telegram.sendMessage(
      Number(telegramUserId),
      "Almost there! We just need your delivery details before we can place this order.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Add my details", "update_details")],
      ])
    );
  } catch (err) {
    logger.error(
      { err, telegramUserId },
      "Failed to notify customer details required"
    );
  }
}
