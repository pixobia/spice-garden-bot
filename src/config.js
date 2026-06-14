import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  BOT_TOKEN: z.string().min(1, "BOT_TOKEN required — get one from @BotFather"),
  BOT_USERNAME: z.string().optional().default(""),
  PUBLIC_URL: z.string().url(),

  ADMIN_CHAT_ID: z.coerce
    .number()
    .int()
    .refine(
      (n) => n !== 0,
      "ADMIN_CHAT_ID required — DM @userinfobot to get your numeric Telegram id"
    ),
  ADMIN_TOKEN: z.string().min(1),
  ADMIN_MOBILE_NUMBER: z.string().min(1),

  MERCHANT_VPA: z.string().min(1),
  MERCHANT_NAME: z.string().min(1),
  // Merchant Category Code from your Paytm for Business dashboard. Optional —
  // when set, it's added to the UPI intent so the txn is classified as a
  // merchant collection (P2M) rather than a person-to-person transfer.
  MERCHANT_MCC: z.string().optional().default(""),
  DELIVERY_FEE_RUPEES: z.coerce.number().int().nonnegative().default(40),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  DELIVERY_FEE: parsed.data.DELIVERY_FEE_RUPEES,
  CATEGORY_ORDER: [
    "Pizza",
    "Burgers",
    "Sandwiches",
    "Wraps",
    "Burrito Bowls",
    "Veg Meals",
    "Non-Veg Meals",
    "Rice Specials",
    "Pasta",
    "Maggi",
    "Momos",
    "Korean Buns",
    "Nuggets & Chicken",
    "Egg Specials",
    "Fries & Sides",
    "Fruit Bowls",
    "Milkshakes",
    "Cold Coffee",
    "Fresh Juices",
    "Mocktails",
    "Tea & Coffee",
  ],
};
