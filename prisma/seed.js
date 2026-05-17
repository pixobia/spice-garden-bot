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

// Prices in whole rupees. Item names match the printed menu.
const menu = [
  ['Fruit Bowls', 'fruit', [
    ['Fresh Watermelon Bowl',              49],
    ['Fresh Papaya Bowl',                  49],
    ['Season Surprise Fruit Salad',        69],
    ['Udapi Style Spiced Pineapple Bowl', 119],
    ['Exotic Fruit Bowl',                  59],
    ['Watermelon Mint Muddle Bowl',        49],
    ['Masala Guava Bowl',                  69],
    ['Citrus Love Bowl',                  109],
    ['Badam Milk and Mixed Fruit Bowl',    69],
    ['Fresh Apple Bowl',                  119],
    ['Fresh Dragon Fruit Bowl',            49],
    ['Fresh Muskmelon Bowl',               99],
    ['Dragon Fruit Watermelon Mixed Bowl', 69],
    ['Watermelon Papaya Mixed Bowl',      109],
    ['Fresh Pomegranate Bowl',            269],
    ['Family Pack Fruit',                 369],
    ['Gift Pack',                          49],
    ['Guava Bowl',                         59],
  ]],

  ['Non-Veg Special Salads', 'salad', [
    ['CrunchChick', 130],
    ['FiestaChick', 140],
    ['EggCream',    100],
  ]],

  ['Veg Special Salads', 'salad', [
    ['PaneerCrunch', 120],
    ['CornCream',     90],
    ['VegDelight',   100],
  ]],

  ['Meals & Combos', 'combo', [
    ['Snack Meal',    150],
    ['Dinner Meal',   220],
    ['Steak Meal',    240],
    ['Family Meal',   350],
    ['Chicken Wings', 120],
  ]],

  ['Burgers', 'burger', [
    ['Veg Burger',                    79],
    ['Paneer Burger',                 90],
    ['Chicken Burger',                90],
    ['Tandoori Burger',              135],
    ['Special Burger',               150],
    ['Barbecue Chicken Burger',      125],
    ['Sizzler Burger',               169],
    ['Dynamite Burger',              139],
    ['Zinger Burger',                120],
    ['Nashville Zinger Burger',      169],
    ['Mega Zinger Burger',           150],
    ['Egg Burger',                    70],
    ['Aloo Tikka Burger',             70],
    ['Shawarma Burger',              140],
    ['Chicken + Paneer Veg Burger',  150],
  ]],

  ['Wraps', 'wrap', [
    ['Veg Wrap',             80],
    ['Paneer Wrap',          90],
    ['Egg Wrap',             90],
    ['Chicken Wrap',        100],
    ['Zinger Wrap',         100],
    ['Veg Nugget Wrap',     110],
    ['Chicken Nugget Wrap', 120],
    ['Chicken Strips Wrap', 129],
  ]],

  ['Nuggets & Chicken', 'chicken', [
    ['Veg Nuggets',                             79],
    ['Chicken Soucy Nuggets',                  139],
    ['Chicken Fried Strips',                   149],
    ['Chicken Fried Wings (4 pcs)',            120],
    ['Chicken Popcorn',                        119],
    ['Saucy Pan Tossed Fried Wings (4 pcs)',   149],
    ['Saucy Pan Tossed Fried Strips (5 pcs)',  169],
  ]],

  ['Momos / Sandwiches', 'sandwich', [
    ['Veg Momo',                70],
    ['Chicken Momo',            80],
    ['Paneer Momo',             80],
    ['Veg Sandwich',            60],
    ['Egg Sandwich',            80],
    ['Paneer Sandwich',         80],
    ['Chicken Sandwich',        90],
    ['Chicken Club',           129],
    ['Paneer Club',            120],
    ['Veg Club',                99],
    ['Saucy Pan Toasted Momos', 99],
  ]],

  ['Maggie', 'noodles', [
    ['Veg Maggie',               40],
    ['Egg Maggie',               50],
    ['Chicken Maggie',           90],
    ['Paneer Maggie',            90],
    ['Cheese Maggie',            60],
    ['White Sos Veg Maggie',     65],
    ['White Sos Chicken Maggie', 70],
    ['White Sos Al Fredo',       70],
    ['Chicken Nacho',            79],
  ]],

  ['Pasta', 'pasta', [
    ['White Sauce Veg Pasta', 89],
    ['Red Sauce Veg Pasta',   79],
    ['Chicken Pasta',         99],
    ['Chicken Alfredo',       89],
    ['Francisco Predo',      119],
  ]],

  ['Porotta', 'paratha', [
    ['Boile Egg Porotta',      60],
    ['Chicken Porotta',        70],
    ['Chilli Chicken Porotta', 99],
    ['Francisco Porotta',     109],
    ['Zinger Porotta',        119],
  ]],

  ['Pizza', 'pizza', [
    ['Pizza Veg',              120],
    ['Pizza Chicken',          149],
    ['Punjabi Samosa (5 pcs)',  49],
  ]],

  ['Fries & Sides', 'fries', [
    ['French Fries Normal',             70],
    ['French Fries Peri Peri',          80],
    ['Chicken Loaded Fries',           120],
    ['Veg Paneer Loaded Fries',        130],
    ['Korean Sweet Loaded Fries',      149],
    ['Kogi Kalbi Chilli Loaded Fries', 149],
    ['Potato Wedges',                   89],
    ['Nachos',                         120],
  ]],

  ['Fresh Juice', 'juice', [
    ['Lime Juice',     30],
    ['Ginger Lime',    35],
    ['Mint Lime',      35],
    ['Grape Lime',     40],
    ['Mosumbi',        50],
    ['Orange',         50],
    ['Papaya',         50],
    ['Watermelon',     50],
    ['Pineapple',      50],
    ['Grape',          60],
    ['Mango',          50],
    ['Mixed Cocktail', 60],
    ['Pomegranate',    80],
  ]],

  ['Milk Shake', 'milkshake', [
    ['Butter Fruit',   89],
    ['Banana',         70],
    ['Papaya',         70],
    ['Guava',          70],
    ['Chickku',        70],
    ['Strawberry',     79],
    ['Carrot',         79],
    ['Jackfruit',      79],
    ['Tender Coconut', 79],
    ['Mango',          79],
  ]],

  ['Ice Cream Shake', 'icecream', [
    ['Vanilla',       90],
    ['Strawberry',    90],
    ['Mango',         90],
    ['Chocolate',     90],
    ['Butter Scotch', 90],
    ['Black Currant', 90],
  ]],

  ['Dry Fruit Milk Shake', 'milkshake', [
    ['Kitkat',           79],
    ['Snickers',         79],
    ['Dates',            89],
    ['Sharjah',          89],
    ['Cold Coffee',      89],
    ['Kannur Cocktail',  89],
    ['Abood',            99],
    ['Casata',          110],
  ]],

  ['Avil Milk', 'milk', [
    ['Avil Milk Plain',            70],
    ['Mango Avil Milk',            90],
    ['Mango Avil Milk Plain',      90],
    ['Pineapple Avil Milk',       100],
    ['Butterscotch Avil Milk',    100],
    ['Tender Coconut Avil Milk',  100],
    ['Oreo Avil Milk',            110],
    ['Mixed Dry Fruit Avil Milk', 130],
  ]],

  ['Mojitos', 'mojito', [
    ['Passion Fruit Mojito', 79],
    ['Strawberry Mojito',    79],
    ['Mint Mojito',          79],
    ['Blue Lagoon Mojito',   79],
    ['Green Apple Mojito',   79],
    ['Chilli Guava',         79],
    ['Ice Tea',              79],
  ]],

  ['Healthy Juices', 'juice', [
    ['ABC',      90],
    ['Carrot',   70],
    ['Beetroot', 50],
  ]],

  ['Lassi', 'lassi', [
    ['Sweet Lassi',       50],
    ['Mango Lassi',       60],
    ['Banana Lassi',      60],
    ['Apple Lassi',       60],
    ['Pomegranate Lassi', 80],
  ]],

  ['Soda Special', 'soda', [
    ['Lime Soda',      40],
    ['Masala Soda',    40],
    ['Mint Lime Soda', 40],
    ['Pineapple Soda', 40],
    ['Nannari Soda',   45],
    ['Kom Kom Soda',   45],
  ]],

  ['Falooda', 'dessert', [
    ['Fruit Salad',                 99],
    ['Fruit Salad with Ice Cream', 110],
    ['Royal Falooda',              120],
    ['Normal Falooda',             130],
    ['Tender Coconut SP Falooda',  120],
  ]],

  ['Special Sarbath', 'drink', [
    ['Nannari Sarbath',      40],
    ['Lemon Kuluki',         70],
    ['Boost Kuluki',         80],
    ['Grape Fruit Kuluki',   80],
    ['Passion Fruit Kuluki', 80],
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
