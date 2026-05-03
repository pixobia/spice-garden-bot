import crypto from 'node:crypto';
import { config } from '../config.js';
import * as customerService from '../services/customer.js';

/**
 * Verify Telegram WebApp initData per the Mini App auth spec.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * 1. Parse the initData query string.
 * 2. Sort fields alphabetically, join as `key=value\nkey=value...`.
 * 3. secret_key = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN)
 * 4. computed_hash = HMAC_SHA256(key=secret_key, message=data_check_string)
 * 5. Compare to provided hash.
 *
 * On success, attaches req.telegramUser = { id, first_name, username, ... }
 * and req.customer (the DB row, find-or-created on the fly).
 */
export async function telegramAuth(req, res, next) {
  try {
    const auth = req.header('Authorization') || '';
    const match = auth.match(/^tma\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'missing_initData' });
    }
    const initData = match[1];

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return res.status(401).json({ error: 'missing_hash' });
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.BOT_TOKEN)
      .digest();

    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computed !== hash) {
      return res.status(401).json({ error: 'bad_signature' });
    }

    // Optional staleness check: reject initData older than 1 hour
    const authDate = Number(params.get('auth_date'));
    if (!authDate || Date.now() / 1000 - authDate > 60 * 60) {
      return res.status(401).json({ error: 'stale_initData' });
    }

    const userJson = params.get('user');
    if (!userJson) return res.status(401).json({ error: 'missing_user' });
    const tgUser = JSON.parse(userJson);

    req.telegramUser = tgUser;
    req.customer = await customerService.findOrCreate(tgUser.id);
    next();
  } catch (err) {
    next(err);
  }
}
