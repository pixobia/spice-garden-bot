import { Router } from 'express';
import { telegramAuth } from '../middleware/telegramAuth.js';
import * as ctrl from '../controllers/miniapp.js';

const router = Router();

router.get('/init', telegramAuth, ctrl.getInit);

export default router;
