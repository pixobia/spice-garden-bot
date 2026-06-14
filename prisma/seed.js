import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Image strategy:
// Each item gets a unique placehold.co URL with its name and a pastel
// background colour picked deterministically from its name hash. These
// load instantly with 100% uptime — no AI service or third-party CDN to
// flake out.
//
// To use real photos: open Prisma Studio (`npx prisma studio`), find the
// item row in the `items` table, and paste your Cloudinary/S3/Unsplash
// URL into `imageUrl`. Or edit this script to replace `img(name)` with a
// hand-curated map keyed by item name.
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
};

// 8 soft pastel backgrounds — gives the menu visual variety without
// being garish. Foreground is a single dark slate.
const BG = ['E5E7EB', 'FED7D7', 'FEF3C7', 'D1FAE5', 'DBEAFE', 'E0E7FF', 'F3E8FF', 'FCE7F3'];
const FG = '4B5563';

const img = (name) => {
  const bg = BG[hash(name) % BG.length];
  return `https://placehold.co/400x300/${bg}/${FG}/png?text=${encodeURIComponent(name)}&font=raleway`;
};

// Prices in whole rupees. Item names match the printed Crust & Fuel menu.
const menu = [
  ['Pizza', 'pizza', [
    ['Plain Cheese Pizza',            89],
    ['Seasonal Vegetable Pizza',     119],
    ['Corn Cheese Pizza',            119],
    ['Paneer Tikka Pizza',           139],
    ['Peri Peri Chicken Pizza',      159],
    ['BBQ Chicken Jalapeño Pizza',   169],
    ['Chicken Tikka Pizza',          179],
    ['Chicken Sausage & Onion Pizza', 179],
  ]],

  ['Burgers', 'burger', [
    ['Veggie Supreme Burger',         99],
    ['Spicy Paneer Burger',          109],
    ['Classic Chicken Burger',       119],
    ['Caribbean Jerk Chicken Burger', 139],
    ['BBQ Chicken Burger',           149],
    ['Healthy Egg & Chicken Burger', 159],
  ]],

  ['Sandwiches', 'sandwich', [
    ['Tomato Cucumber Cheese Sandwich', 69],
    ['Egg Mayo Sandwich',               79],
    ['Paneer Tikka Sandwich',           85],
    ['Chicken Tikka Sandwich',          89],
    ['Peri Peri Chicken Sandwich',      89],
  ]],

  ['Wraps', 'wrap', [
    ['Egg Wrap',                      85],
    ['Veg Nugget Wrap',               89],
    ['Paneer Khurchan Wrap',          99],
    ['Chicken Nugget Wrap',           99],
    ['Spicy Chicken Sausage Wrap',    99],
    ['Kolkata Style Egg Chicken Wrap', 99],
  ]],

  ['Burrito Bowls', 'burrito', [
    ['Mexican Chilli Paneer Bowl', 249],
    ['Mexican Chicken Bowl',       279],
  ]],

  ['Veg Meals', 'meal', [
    ['Paneer Butter Masala, Jeera Rice & Lime Onion', 199],
    ['Paneer Manchurian with Veg Fried Rice',         199],
  ]],

  ['Non-Veg Meals', 'meal', [
    ['Butter Chicken, Jeera Rice & Lime Onion',     229],
    ['Chilli Garlic Chicken with Egg Fried Rice',   229],
  ]],

  ['Rice Specials', 'rice', [
    ['Egg Fried Rice',             89],
    ['Schezwan Chicken Fried Rice', 179],
  ]],

  ['Pasta', 'pasta', [
    ['White Sauce Veg Pasta', 129],
    ['Red Sauce Veg Pasta',   139],
    ['Pink Sauce Pasta',      149],
    ['Add Chicken',            40],
  ]],

  ['Maggi', 'noodles', [
    ['Veg Maggi',             49],
    ['Egg Maggi',             59],
    ['Cheese Maggi',          79],
    ['Paneer Maggi',          79],
    ['Chicken Maggi',         89],
    ['Chicken Sausage Maggi', 89],
  ]],

  ['Momos', 'momos', [
    ['Veg Momos',     79],
    ['Paneer Momos',  89],
    ['Chicken Momos', 99],
  ]],

  ['Korean Buns', 'bun', [
    ['Cheese Garlic Bun',  69],
    ['Chicken Cheese Bun', 89],
  ]],

  ['Nuggets & Chicken', 'chicken', [
    ['Veg Nuggets',                  79],
    ['Chicken Saucy Nuggets',        79],
    ['Grilled Chicken Sausage (3 pcs)', 99],
    ['Chicken Fried Strips (3 pcs)', 139],
    ['Chicken Fried Wings (6 pcs)',  149],
  ]],

  ['Egg Specials', 'egg', [
    ['Plain Omelette',                      49],
    ['Cheese Omelette',                     59],
    ['Masala Omelette',                     59],
    ['Bread Omelette',                      59],
    ['Classic Egg Scramble',                69],
    ['Chicken Sausage & Cheese Omelette',   79],
  ]],

  ['Fries & Sides', 'fries', [
    ['French Fries',          79],
    ['Peri Peri Fries',       89],
    ['Loaded Cheese Fries',  129],
    ['Potato Wedges',        129],
    ['Chicken Loaded Fries', 159],
  ]],

  ['Fruit Bowls', 'fruit', [
    ['Watermelon Bowl',     49],
    ['Muskmelon Bowl',      49],
    ['Papaya Bowl',         49],
    ['Pineapple Bowl',      49],
    ['Seasonal Fruit Salad', 59],
  ]],

  ['Milkshakes', 'milkshake', [
    ['Vanilla Milkshake',        79],
    ['Banana Milkshake',         79],
    ['Chocolate Milkshake',      79],
    ['Salted Caramel Milkshake', 89],
    ['Oreo Milkshake',           89],
    ['KitKat Milkshake',         89],
    ['Brownie Milkshake',       109],
  ]],

  ['Cold Coffee', 'coffee', [
    ['Cold Coffee',           79],
    ['Coffee Frappe',         89],
    ['Salted Caramel Frappe', 119],
  ]],

  ['Fresh Juices', 'juice', [
    ['Watermelon Juice', 49],
    ['Pineapple Juice',  49],
    ['Papaya Juice',     49],
    ['ABC Juice',        89],
  ]],

  ['Mocktails', 'mocktail', [
    ['Andhra Special Sarbath', 49],
    ['Fresh Lime Soda',        49],
    ['Mojito',                 59],
    ['Lemon Iced Tea',         59],
    ['Citrus Blue',            79],
    ['Watermelon Lemonade',    79],
  ]],

  ['Tea & Coffee', 'tea', [
    ['Tea',                15],
    ['Ginger Tea',         20],
    ['Milk',               20],
    ['Honey Lemon Tea',    25],
    ['Regular Coffee',     25],
    ['Green Tea',          30],
    ['Filter Coffee',      30],
    ['Hot Chocolate',      49],
    ['Add Boost / Horlicks', 5],
  ]],
];

async function main() {
  console.log('Clearing existing items...');
  await prisma.item.deleteMany({});

  let count = 0;
  for (const [categoryName, keyword, items] of menu) {
    for (const [name, price] of items) {
      await prisma.item.create({
        data: {
          categoryName,
          name,
          price,
          imageUrl: img(name),
          isAvailable: true,
        },
      });
      count++;
    }
  }

  console.log(`Seed complete — inserted ${count} items across ${menu.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
