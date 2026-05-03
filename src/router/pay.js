import { Router } from 'express';
import * as ctrl from '../controllers/pay.js';

const router = Router();

router.get('/:orderId', ctrl.redirectToUpi);

export default router;
