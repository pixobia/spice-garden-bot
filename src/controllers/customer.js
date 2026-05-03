import { z } from 'zod';
import * as customerService from '../services/customer.js';

const updateSchema = z.object({
  name: z.string().min(1).max(60),
  phone: z.string().regex(/^[+\d\s-]{6,20}$/, 'invalid phone'),
  address: z.string().min(5).max(300),
});

export async function getMe(req, res, next) {
  try {
    const c = req.customer;
    res.json({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      hasCompleteDetails: customerService.hasCompleteDetails(c),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const data = updateSchema.parse(req.body);
    const updated = await customerService.updateDetails(req.customer.id, data);
    res.json({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      address: updated.address,
      hasCompleteDetails: customerService.hasCompleteDetails(updated),
    });
  } catch (err) {
    next(err);
  }
}
