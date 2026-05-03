import * as miniappService from '../services/miniapp.js';

export async function getInit(req, res, next) {
  try {
    const data = await miniappService.getInitData(req.telegramUser.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
