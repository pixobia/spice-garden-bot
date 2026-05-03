import { Router } from 'express';
import { telegramAuth } from '../middleware/telegramAuth.js';
import * as ctrl from '../controllers/order.js';

const router = Router();

router.use(telegramAuth);

router.post('/cart', ctrl.getOrCreateCart);
router.get('/:id', ctrl.getOrder);
router.post('/:id/items', ctrl.setItemQuantity);
router.delete('/:id/items/:itemId', ctrl.removeItem);
router.post('/:id/place', ctrl.placeOrder);

export default router;
