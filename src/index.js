import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db.js';

import { bot } from './bot/bot.js';
import { registerAllHandlers } from './bot/register.js';

import menuRouter from './router/menu.js';
import orderRouter from './router/order.js';
import customerRouter from './router/customer.js';
import miniappRouter from './router/miniapp.js';
import adminRouter from './router/admin.js';

import { errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  // 1. Bot — register handlers (handlers are pure functions that take `bot`)
  registerAllHandlers(bot);

  // 2. Express
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  // Static — Mini App and uploaded images
  app.use('/miniapp', express.static(path.join(projectRoot, 'public', 'miniapp')));
  app.use('/uploads', express.static(path.join(projectRoot, 'uploads')));

  // Health
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // API
  app.use('/api/menu', menuRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/miniapp', miniappRouter);
  app.use('/api/admin', adminRouter);

  app.use(errorHandler);

  // 3. Start
  app.listen(config.PORT, () => {
    logger.info(`API listening on http://localhost:${config.PORT}`);
    logger.info(`Mini App  : ${config.PUBLIC_URL}/miniapp/`);
  });

  await bot.launch();
  logger.info('Telegram bot started (long polling)');

  // 4. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    bot.stop(signal);
    await db.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
