import { Markup } from "telegraf";
import { bot } from "../bot/bot.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import * as orderService from "./order.js";
import * as customerService from "./customer.js";
import * as upiService from "./upi.js";

const fmtINR = (paise) => `₹${(paise / 100).toLocaleString("en-IN")}`;

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
    `Delivery: ${fmtINR(order.deliveryFee)}`,
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
    "Thanks for ordering with Spice Garden.",
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
 */
export async function notifyCustomerUpiQr(telegramUserId, order) {
  const chatId = Number(telegramUserId);
  const uri = upiService.buildUri({
    orderId: order.id,
    amountPaise: order.total,
  });
  const ref = upiService.buildRef(order.id);
  const payUrl = `${config.PUBLIC_URL}/pay/${order.id}`;

  const caption = [
    `*Order #${order.id}  ·  ${fmtINR(order.total)}*`,
    "Tap *Pay with UPI app* below, or scan the QR above.",
  ].join("\n");

  try {
    const qrPng = await upiService.generateQrPng(uri);

    await bot.telegram.sendPhoto(
      chatId,
      { source: qrPng },
      {
        caption,
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("Pay with UPI app", payUrl)],
        ]),
      }
    );

    await bot.telegram.sendMessage(
      chatId,
      `We'll confirm once your payment is received.  ·  Reference: ${ref}`
    );
  } catch (err) {
    logger.error(
      { err, orderId: order.id, telegramUserId },
      "Failed to send UPI QR to customer"
    );
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
