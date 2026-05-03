import { Telegraf, session } from 'telegraf';
import { config } from '../config.js';

export const bot = new Telegraf(config.BOT_TOKEN);

// In-memory session — fine for single-instance dev. Swap to Redis for prod scale.
bot.use(session({ defaultSession: () => ({}) }));
