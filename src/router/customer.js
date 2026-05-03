import { Router } from 'express';
import { telegramAuth } from '../middleware/telegramAuth.js';
import * as ctrl from '../controllers/customer.js';

const router = Router();

router.use(telegramAuth);
router.get('/me', ctrl.getMe);
router.put('/me', ctrl.updateMe);

export default router;
