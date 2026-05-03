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

export async function updateDetails(id, { name, phone, address }) {
  return customerDal.updateDetails(id, { name, phone, address });
}

export function hasCompleteDetails(customer) {
  return Boolean(customer && customer.name && customer.phone && customer.address);
}
