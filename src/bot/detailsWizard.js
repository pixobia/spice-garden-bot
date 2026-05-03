import { Scenes } from 'telegraf';
import { Markup } from 'telegraf';
import * as customerService from '../services/customer.js';
import { sendDetailsConfirm } from './confirmDetails.js';

const PHONE_RE = /^[+\d\s-]{6,20}$/;

/**
 * Wizard: name → phone → address.
 * If ctx.session.pendingOrderId exists, we re-show the confirm screen at the end.
 */
export const detailsWizard = new Scenes.WizardScene(
  'details_wizard',

  // Step 1: ask name
  async (ctx) => {
    await ctx.reply('What is your full name?');
    return ctx.wizard.next();
  },

  // Step 2: receive name, ask phone
  async (ctx) => {
    const name = ctx.message?.text?.trim();
    if (!name || name.length < 2 || name.length > 60) {
      await ctx.reply('Please send a valid name (2–60 characters).');
      return;
    }
    ctx.wizard.state.name = name;
    await ctx.reply('And your phone number? (Indian format, e.g. +91 98xxx xxxxx)');
    return ctx.wizard.next();
  },

  // Step 3: receive phone, ask address
  async (ctx) => {
    const phone = ctx.message?.text?.trim();
    if (!phone || !PHONE_RE.test(phone)) {
      await ctx.reply('That phone number does not look right. Please send it again.');
      return;
    }
    ctx.wizard.state.phone = phone;
    await ctx.reply('Finally, your delivery address? (Building, street, area, city)');
    return ctx.wizard.next();
  },

  // Step 4: receive address, save, exit
  async (ctx) => {
    const address = ctx.message?.text?.trim();
    if (!address || address.length < 5 || address.length > 300) {
      await ctx.reply('Address looks too short — please include building, street and city.');
      return;
    }
    ctx.wizard.state.address = address;

    const customer = await customerService.findByTelegramId(ctx.from.id);
    await customerService.updateDetails(customer.id, {
      name: ctx.wizard.state.name,
      phone: ctx.wizard.state.phone,
      address,
    });

    await ctx.reply(
      'Thanks — saved.',
      Markup.removeKeyboard(),
    );

    const pendingOrderId = ctx.session?.pendingOrderId;
    await ctx.scene.leave();

    if (pendingOrderId) {
      ctx.session.pendingOrderId = null;
      await sendDetailsConfirm(ctx, pendingOrderId);
    }
  },
);
