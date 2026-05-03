import { config } from '../config.js';

export function adminAuth(req, res, next) {
  const provided = req.header('X-Admin-Token');
  if (!provided || provided !== config.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
