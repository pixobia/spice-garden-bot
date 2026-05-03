import { Scenes, Markup } from 'telegraf';
import * as customerService from '../services/customer.js';
import * as orderService from '../services/order.js';
import * as notify from '../services/notify.js';
import { logger } from '../logger.js';

const PHONE_RE = /^[+\d\s-]{6,20}$/;

const FIELDS = {
  name: {
    label: 'Name',
    prompt: 'Send your full name.',
    validate: (v) =>
      v.length < 2 || v.length > 60
        ? 'Please send a valid name (2–60 characters).'
        : null,
  },
  phone: {
    label: 'Phone',
    prompt: 'Send your phone number. (e.g. +91 98xxx xxxxx)',
    validate: (v) =>
      !PHONE_RE.test(v)
        ? "That phone number does not look right. Please send it again."
        : null,
  },
  address: {
    label: 'Address',
    prompt: 'Send your delivery address. (Building, street, area, city)',
    validate: (v) =>
      v.length < 5 || v.length > 300
        ? 'Address looks too short — please include building, street and city.'
        : null,
  },
};

/**
 * Single-field update. Entered with `ctx.scene.enter('field_update', { field })`.
 * After save, we re-show the confirm-details DM if a pendingOrderId is in session.
 */
export const fieldUpdate = new Scenes.BaseScene('field_update');

fieldUpdate.enter(async (ctx) => {
  const field = ctx.scene.state.field;
  const def = FIELDS[field];
  if (!def) {
    await ctx.scene.leave();
    return;
  }
  const customer = await customerService.findByTelegramId(ctx.from.id);
  const current = customer?.[field] || '(not set)';
  await ctx.reply(
    `Current ${def.label.toLowerCase()}: ${current}\n\n${def.prompt}`,
    Markup.removeKeyboard(),
  );
});

fieldUpdate.on('text', async (ctx) => {
  const field = ctx.scene.state.field;
  const def = FIELDS[field];
  if (!def) return ctx.scene.leave();

  const value = ctx.message.text.trim();
  const err = def.validate(value);
  if (err) {
    await ctx.reply(err);
    return;
  }

  try {
    const customer = await customerService.findByTelegramId(ctx.from.id);
    await customerService.updateDetails(customer.id, { [field]: value });
    await ctx.reply(`${def.label} updated.`);
  } catch (e) {
    logger.error({ err: e, field }, 'Failed to update field');
    await ctx.reply('Sorry, could not save that. Please try again.');
    return;
  }

  await ctx.scene.leave();

  // After updating, re-show the confirm-details prompt if a pending order is waiting.
  const pendingOrderId = ctx.session?.pendingOrderId;
  if (pendingOrderId) {
    const customer = await customerService.findByTelegramId(ctx.from.id);
    if (customerService.hasCompleteDetails(customer)) {
      await notify.notifyCustomerConfirmDetails(customer, pendingOrderId);
    }
  }
});
