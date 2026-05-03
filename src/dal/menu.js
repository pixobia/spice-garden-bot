import { db } from '../db.js';

export async function listAvailableItems() {
  return db.item.findMany({
    where: { isAvailable: true },
    orderBy: [{ categoryName: 'asc' }, { name: 'asc' }],
  });
}

export async function findItemById(id) {
  return db.item.findUnique({ where: { id } });
}

export async function findItemsByIds(ids) {
  if (!ids?.length) return [];
  return db.item.findMany({ where: { id: { in: ids } } });
}

export async function setItemAvailability(id, isAvailable) {
  return db.item.update({ where: { id }, data: { isAvailable } });
}
