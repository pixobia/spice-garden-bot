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

/**
 * Partial update: only fields explicitly present in `fields` are written.
 * Pass any subset of { name, phone, address }.
 */
export async function updateDetails(id, fields) {
  const data = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.phone !== undefined) data.phone = fields.phone;
  if (fields.address !== undefined) data.address = fields.address;
  return db.customer.update({ where: { id }, data });
}
