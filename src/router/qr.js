import { Router } from 'express';
import * as ctrl from '../controllers/qr.js';

const router = Router();

// Matches /qr/29 and /qr/29.png — the .png suffix is what we put in URLs so
// Telegram (and any link unfurler) sees a real image extension.
router.get('/:orderId', ctrl.renderQrPng);

export default router;
