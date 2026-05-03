import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Serialise BigInt fields (e.g. Customer.telegramUserId) to JSON-friendly strings.
// Without this, JSON.stringify throws on BigInt values.
BigInt.prototype.toJSON = function () {
  return this.toString();
};
