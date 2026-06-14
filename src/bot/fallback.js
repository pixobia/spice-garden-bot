import { Markup } from 'telegraf';
import { config } from '../config.js';
import * as customerService from '../services/customer.js';

const miniappUrl = () => `${config.PUBLIC_URL}/miniapp/`;

const menuKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.webApp('View menu', miniappUrl())]]);

/**
 * Makes the bot interactive for users who don't know any command.
 *
 * Registered LAST in the handler chain, after:
 *   - the scene/stage middleware (so wizard input — name/phone/address — is
 *     consumed by the active scene and never reaches the catch-all), and
 *   - registerMiniappData's `bot.on('message')` (which handles web_app_data and
 *     calls next() only for ordinary messages).
 *
 * So the catch-all here only fires for messages nothing else claimed.
 */
export default function registerFallback(bot) {
  // /menu — open the menu directly.
  bot.command('menu', async (ctx) => {
    await customerService.findOrCreate(ctx.from.id);
    await ctx.reply('Here’s our menu — tap to browse and order:', menuKeyboard());
  });

  // /help — explain how to use the bot.
  bot.help(async (ctx) => {
    await customerService.findOrCreate(ctx.from.id);
    await ctx.reply(
      [
        'I’m the Crust & Fuel ordering bot. 🍔',
        '',
        '• Tap “View menu” below, or the “Order” button next to the message box, to browse and order.',
        '• /menu — open the menu',
        '• /start — restart',
      ].join('\n'),
      menuKeyboard(),
    );
  });

  // Catch-all — any other message (free text, an unknown command, a sticker…).
  // Nudge the user to the menu instead of staying silent.
  bot.on('message', async (ctx) => {
    await customerService.findOrCreate(ctx.from.id);
    await ctx.reply(
      'Tap below to browse the menu and order in a few taps. 🍔\n\nYou can also use the “Order” button next to the message box anytime.',
      menuKeyboard(),
    );
  });
}
