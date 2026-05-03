import { Router } from 'express';
import { telegramAuth } from '../middleware/telegramAuth.js';
import * as ctrl from '../controllers/menu.js';

const router = Router();

router.get('/', telegramAuth, ctrl.getMenu);

export default router;
