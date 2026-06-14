import * as menuDal from '../dal/menu.js';
import { config } from '../config.js';

// In-memory cache for the built menu. The menu changes rarely (re-seed or an
// availability toggle), but getMenu() is called on every Mini App open and
// every /api/menu hit — so caching removes a DB query from the hot path.
//
// Invalidation is two-layered:
//   1. setItemAvailability() clears it explicitly, so admin toggles show up on
//      the very next open.
//   2. The TTL is a long safety net for changes made OUTSIDE the app (Prisma
//      Studio, `npm run db:seed`, raw SQL) — those don't call
//      invalidateMenuCache(). The menu rarely changes, so the TTL is set to a
//      week; in practice a re-seed or deploy restarts the process and clears
//      this in-memory cache anyway. If you edit items live without restarting,
//      call invalidateMenuCache() (or restart) to see the change sooner.
let menuCache = null;
let menuCacheAt = 0;
const MENU_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

export function invalidateMenuCache() {
  menuCache = null;
}

/**
 * Returns categories grouped, sorted by config.CATEGORY_ORDER.
 * Categories not in CATEGORY_ORDER fall to the end alphabetically.
 *
 * Shape: [{ name, count, items: [{ id, name, price, imageUrl }] }]
 */
export async function getMenu() {
  if (menuCache && Date.now() - menuCacheAt < MENU_TTL_MS) return menuCache;

  const items = await menuDal.listAvailableItems();

  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.categoryName)) byCategory.set(item.categoryName, []);
    byCategory.get(item.categoryName).push({
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
    });
  }

  const orderIndex = (name) => {
    const i = config.CATEGORY_ORDER.indexOf(name);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  menuCache = [...byCategory.entries()]
    .map(([name, items]) => ({ name, count: items.length, items }))
    .sort((a, b) => {
      const oa = orderIndex(a.name);
      const ob = orderIndex(b.name);
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
  menuCacheAt = Date.now();
  return menuCache;
}

export async function getItem(id) {
  return menuDal.findItemById(id);
}

/**
 * Toggle an item's availability and drop the menu cache so the change is
 * reflected on the next getMenu() call.
 */
export async function setItemAvailability(id, isAvailable) {
  const updated = await menuDal.setItemAvailability(id, isAvailable);
  invalidateMenuCache();
  return updated;
}
