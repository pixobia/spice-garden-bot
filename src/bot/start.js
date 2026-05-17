import { Markup } from 'telegraf';
import { config } from '../config.js';
import * as customerService from '../services/customer.js';

const miniappUrl = () => `${config.PUBLIC_URL}/miniapp/`;

export default function registerStart(bot) {
  bot.start(async (ctx) => {
    // Ensure a Customer row exists for this user.
    await customerService.findOrCreate(ctx.from.id);

    await ctx.reply(
      'Welcome to Crust & Fuel!\n\nCafé & juice bar — fuel your cravings. Tap below to browse the menu and order in a few taps.',
      Markup.inlineKeyboard([
        [Markup.button.webApp('View menu', miniappUrl())],
      ]),
    );
  });
}
