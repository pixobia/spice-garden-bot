import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error({ err, url: req.url, method: req.method }, 'Request error');

  const message = err?.message || 'Internal server error';

  if (message === 'Forbidden') return res.status(403).json({ error: 'forbidden' });
  if (message === 'Order not found' || message === 'Item not found') {
    return res.status(404).json({ error: message.toLowerCase().replace(/\s/g, '_') });
  }
  if (
    message === 'Cart is locked' ||
    message === 'Cart is empty' ||
    message === 'Item not available' ||
    message.startsWith('Cannot mark paid') ||
    message.startsWith('Cannot reject') ||
    message.startsWith('Order is not in cart state')
  ) {
    return res.status(409).json({ error: message });
  }

  res.status(500).json({ error: message });
}
