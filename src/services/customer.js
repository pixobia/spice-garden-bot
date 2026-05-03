import * as customerDal from '../dal/customer.js';

export async function findOrCreate(telegramUserId) {
  return customerDal.findOrCreate(telegramUserId);
}

export async function findByTelegramId(telegramUserId) {
  return customerDal.findByTelegramId(telegramUserId);
}

export async function findById(id) {
  return customerDal.findById(id);
}

/**
 * Partial update — pass any subset of { name, phone, address }.
 * Fields not present are left untouched.
 */
export async function updateDetails(id, fields) {
  return customerDal.updateDetails(id, fields);
}

export function hasCompleteDetails(customer) {
  return Boolean(customer && customer.name && customer.phone && customer.address);
}
