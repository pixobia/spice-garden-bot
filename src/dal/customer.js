import { db } from '../db.js';

export async function findByTelegramId(telegramUserId) {
  return db.customer.findUnique({
    where: { telegramUserId: BigInt(telegramUserId) },
  });
}

export async function findById(id) {
  return db.customer.findUnique({ where: { id } });
}

/**
 * Create a customer row with just the telegramUserId, or return the existing
 * one. Called on /start so we always have a row to FK against later.
 */
export async function findOrCreate(telegramUserId) {
  const tgId = BigInt(telegramUserId);
  return db.customer.upsert({
    where: { telegramUserId: tgId },
    update: {},
    create: { telegramUserId: tgId },
  });
}

export async function updateDetails(id, { name, phone, address }) {
  return db.customer.update({
    where: { id },
    data: { name, phone, address },
  });
}
