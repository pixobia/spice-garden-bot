import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const placeholder = (name) =>
  `https://placehold.co/400x300/e5e7eb/6b7280?text=${encodeURIComponent(name)}`;

const items = [
  // Starters
  { categoryName: 'Starters', name: 'Paneer tikka',     price: 22000 },
  { categoryName: 'Starters', name: 'Veg manchurian',   price: 18000 },
  { categoryName: 'Starters', name: 'Chilli paneer',    price: 21000 },
  { categoryName: 'Starters', name: 'Hara bhara kebab', price: 19000 },

  // Mains
  { categoryName: 'Mains', name: 'Butter chicken',  price: 32000 },
  { categoryName: 'Mains', name: 'Dal makhani',     price: 24000 },
  { categoryName: 'Mains', name: 'Paneer butter masala', price: 26000 },
  { categoryName: 'Mains', name: 'Chicken curry',   price: 30000 },
  { categoryName: 'Mains', name: 'Veg kofta',       price: 22000 },

  // Breads
  { categoryName: 'Breads', name: 'Butter naan',  price: 4000 },
  { categoryName: 'Breads', name: 'Garlic naan',  price: 5000 },
  { categoryName: 'Breads', name: 'Tandoori roti', price: 3000 },

  // Rice & biryani
  { categoryName: 'Rice & biryani', name: 'Veg biryani',     price: 26000 },
  { categoryName: 'Rice & biryani', name: 'Chicken biryani', price: 32000 },
  { categoryName: 'Rice & biryani', name: 'Jeera rice',      price: 16000 },

  // Desserts
  { categoryName: 'Desserts', name: 'Gulab jamun', price: 8000 },
  { categoryName: 'Desserts', name: 'Rasmalai',    price: 10000 },

  // Beverages
  { categoryName: 'Beverages', name: 'Masala chai',     price: 4000 },
  { categoryName: 'Beverages', name: 'Sweet lassi',     price: 7000 },
  { categoryName: 'Beverages', name: 'Fresh lime soda', price: 6000 },
];

async function main() {
  console.log('Clearing existing items...');
  await prisma.item.deleteMany({});

  console.log(`Seeding ${items.length} items...`);
  for (const item of items) {
    await prisma.item.create({
      data: { ...item, imageUrl: placeholder(item.name), isAvailable: true },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
