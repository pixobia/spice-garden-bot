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
import payRouter from './router/pay.js';
import qrRouter from './router/qr.js';

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

  // Health — fast liveness probe, never touches the DB.
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // DB warm-keep. cron-job.org should hit this (not /health) every 10 minutes
  // so Neon's free-tier compute doesn't autosuspend. Pinging /health alone
  // keeps the Render pod awake but the DB still sleeps, which then surfaces
  // as Prisma "terminating connection due to administrator command" (E57P01)
  // on the next real request.
  app.get('/health/db', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch (err) {
      logger.error({ err }, '/health/db failed');
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // Public UPI redirect — bot DM button points here, we 302 to upi://
  app.use('/pay', payRouter);

  // Public QR PNG — Telegram fetches this URL instead of us multipart-uploading
  // the bytes ourselves. See controllers/qr.js for the full rationale.
  app.use('/qr', qrRouter);

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

  // NOTE: the chat menu button (the button next to the message box) is managed
  // via BotFather, not here. We deliberately do NOT call setChatMenuButton —
  // doing so overrides BotFather's setting on every startup, which previously
  // stopped the BotFather-configured button from ever showing.

  // Register the slash-command suggestions shown when a user taps the "/" button
  // or the command menu, so they don't have to know any command exists.
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Start / restart the bot' },
      { command: 'menu', description: 'Browse the menu and order' },
      { command: 'help', description: 'How to use this bot' },
    ]);
    logger.info('Bot commands registered (/start, /menu, /help)');
  } catch (err) {
    logger.error({ err }, 'Failed to set bot commands');
  }

  // 4. Start the bot.
  //
  // Production: webhook mode. Telegram pushes updates to our HTTPS endpoint
  // as POST requests — no long-polling, so no 409 conflicts when Render
  // rotates containers, and no in-flight polling stream to get killed during
  // pod hibernation. This is the only reliable mode on shared cloud hosts.
  //
  // Development: long-polling. No public URL required, simpler to iterate.
  const WEBHOOK_PATH = '/telegram-webhook';
  if (config.NODE_ENV === 'production') {
    app.use(
      await bot.createWebhook({ domain: config.PUBLIC_URL, path: WEBHOOK_PATH }),
    );
    logger.info(`Telegram webhook registered: ${config.PUBLIC_URL}${WEBHOOK_PATH}`);
  } else {
    bot.launch().then(() => logger.info('Telegram bot started (long polling)'));
  }

  // 5. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    // bot.stop() throws "Bot is not running!" if launch() was never called
    // (webhook mode skips launch). Swallow it — there's nothing to stop.
    try {
      bot.stop(signal);
    } catch (err) {
      /* webhook mode: no polling loop to terminate */
    }
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
