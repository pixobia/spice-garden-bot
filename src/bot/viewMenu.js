import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Markup } from 'telegraf';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const menuImagePath = path.join(projectRoot, 'uploads', 'menu.jpg');

const miniappUrl = () => `${config.PUBLIC_URL}/miniapp/`;

export default function registerViewMenu(bot) {
  bot.action('view_menu', async (ctx) => {
    await ctx.answerCbQuery();
    if (fs.existsSync(menuImagePath)) {
      await ctx.replyWithPhoto(
        { source: menuImagePath },
        {
          caption: 'Tap below to start ordering.',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('Order now', miniappUrl())],
          ]),
        },
      );
    } else {
      await ctx.reply(
        'Menu image is not configured yet. Tap below to browse our catalog.',
        Markup.inlineKeyboard([
          [Markup.button.webApp('Order now', miniappUrl())],
        ]),
      );
    }
  });
}
