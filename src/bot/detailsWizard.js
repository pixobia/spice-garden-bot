import { Scenes } from "telegraf";
import { Markup } from "telegraf";
import * as customerService from "../services/customer.js";
import * as orderService from "../services/order.js";
import * as notify from "../services/notify.js";
import { logger } from "../logger.js";

const PHONE_RE = /^[+\d\s-]{6,20}$/;

/**
 * Wizard: name → phone → address.
 * If ctx.session.pendingOrderId exists when the wizard finishes, the order
 * is placed straight away — UPI QR sent to the user, admin DM'd.
 */
export const detailsWizard = new Scenes.WizardScene(
  "details_wizard",

  // Step 1: ask name
  async (ctx) => {
    await ctx.reply("What is your full name?");
    return ctx.wizard.next();
  },

  // Step 2: receive name, ask phone
  async (ctx) => {
    const name = ctx.message?.text?.trim();
    if (!name || name.length < 2 || name.length > 60) {
      await ctx.reply(
        "Please share your full name (between 2 and 60 letters)."
      );
      return;
    }
    ctx.wizard.state.name = name;
    await ctx.reply(
      "Thanks! What is your phone number?\n\nFor example: +91 98xxx xxxxx"
    );
    return ctx.wizard.next();
  },

  // Step 3: receive phone, ask address
  async (ctx) => {
    const phone = ctx.message?.text?.trim();
    if (!phone || !PHONE_RE.test(phone)) {
      await ctx.reply(
        "That doesn't look like a valid phone number. Please send it again — for example, +91 98xxx xxxxx."
      );
      return;
    }
    ctx.wizard.state.phone = phone;
    await ctx.reply(
      "Last step — your delivery address?\n\nPlease include flat/building, street, area, and city."
    );
    return ctx.wizard.next();
  },

  // Step 4: receive address, save, exit
  async (ctx) => {
    const address = ctx.message?.text?.trim();
    if (!address || address.length < 5 || address.length > 300) {
      await ctx.reply(
        "Your address looks too short. Please include flat/building, street, area, and city."
      );
      return;
    }
    ctx.wizard.state.address = address;

    const customer = await customerService.findByTelegramId(ctx.from.id);
    await customerService.updateDetails(customer.id, {
      name: ctx.wizard.state.name,
      phone: ctx.wizard.state.phone,
      address,
    });

    await ctx.reply("Thanks! Your details are saved.", Markup.removeKeyboard());

    const pendingOrderId = ctx.session?.pendingOrderId;
    if (ctx.session) ctx.session.pendingOrderId = null;
    await ctx.scene.leave();

    if (pendingOrderId) {
      // Place the order now that details exist.
      try {
        const order = await orderService.placeOrder(
          pendingOrderId,
          customer.id
        );
        await Promise.all([
          notify.notifyCustomerUpiQr(customer.telegramUserId, order),
          notify.notifyAdminNewOrder(order),
        ]);
      } catch (err) {
        logger.error(
          { err, pendingOrderId },
          "Failed to place pending order after wizard"
        );
        await ctx.reply(
          "Sorry, we couldn't place your order right now. Please try again in a moment."
        );
      }
    }
  }
);
