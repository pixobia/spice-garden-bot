import * as menuDal from '../dal/menu.js';
import { config } from '../config.js';

/**
 * Returns categories grouped, sorted by config.CATEGORY_ORDER.
 * Categories not in CATEGORY_ORDER fall to the end alphabetically.
 *
 * Shape: [{ name, count, items: [{ id, name, price, imageUrl }] }]
 */
export async function getMenu() {
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

  return [...byCategory.entries()]
    .map(([name, items]) => ({ name, count: items.length, items }))
    .sort((a, b) => {
      const oa = orderIndex(a.name);
      const ob = orderIndex(b.name);
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
}

export async function getItem(id) {
  return menuDal.findItemById(id);
}
