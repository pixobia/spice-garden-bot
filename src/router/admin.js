import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import * as ctrl from '../controllers/admin.js';

const router = Router();

router.use(adminAuth);

router.patch('/items/:id/availability', ctrl.setItemAvailability);
router.post('/orders/:id/mark-paid', ctrl.markPaid);
router.post('/orders/:id/reject', ctrl.rejectOrder);

export default router;
