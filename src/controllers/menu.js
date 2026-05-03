import * as menuService from '../services/menu.js';

export async function getMenu(req, res, next) {
  try {
    const menu = await menuService.getMenu();
    res.json({ categories: menu });
  } catch (err) {
    next(err);
  }
}
