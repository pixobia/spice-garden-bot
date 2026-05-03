# Spice Garden Bot — Implementation Plan

A Telegram food-ordering bot with a Mini App catalog, REST API, Postgres, and UPI payments validated by an admin via Telegram.

---

## 1. Architecture overview

```
┌─────────────┐         ┌──────────────────────────────────────┐
│  Customer   │         │  Single Node.js process               │
│  (Telegram) │◄────────┤                                       │
└─────────────┘         │  ┌─────────────┐   ┌──────────────┐  │
       ▲                │  │  Telegraf   │   │   Express    │  │
       │ web_app        │  │  bot        │   │   API        │  │
       │ button         │  │             │   │              │  │
       ▼                │  │  • /start   │   │  • /menu     │  │
┌─────────────┐         │  │  • scenes   │   │  • /orders   │  │
│  Mini App   │────────►│  │  • admin    │   │  • /miniapp  │  │
│  (HTML/JS)  │  REST   │  │    cb's     │   │  • /admin    │  │
│  /public    │         │  └──────┬──────┘   └──────┬───────┘  │
└─────────────┘         │         │                  │          │
                        │         └────┬─────────────┘          │
                        │              ▼                        │
                        │       ┌──────────────┐                │
                        │       │  Prisma ORM  │                │
                        │       └──────┬───────┘                │
                        └──────────────┼────────────────────────┘
                                       ▼
                                 ┌───────────┐
                                 │ Postgres  │
                                 └───────────┘

         ┌─────────────┐         ▲
         │   Admin     │─────────┘  bot DMs admin on new order
         │ (Telegram)  │            admin DMs back via callback
         └─────────────┘
```

One Node process hosts both the bot (Telegraf, long-polling in dev / webhook in prod) and the REST API (Express). The Mini App is a static HTML/CSS/JS bundle served by Express from `/public/miniapp`. All three talk to the same Postgres via Prisma.

---

## 2. Tech stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Runtime      | Node.js 20+                                                       |
| Bot          | Telegraf v4 (with `telegraf/scenes` for the details wizard)       |
| API          | Express 4                                                         |
| ORM          | Prisma 5                                                          |
| Database     | Postgres 15                                                       |
| Validation   | Zod                                                               |
| QR           | `qrcode` npm package                                              |
| Logging      | Pino                                                              |
| Mini App     | Vanilla HTML/CSS/JS — no bundler. Loads `telegram-web-app.js` from Telegram CDN |
| Hosting      | Railway / Render / Fly (HTTPS required for Mini Apps)             |
| Image storage | Local disk for v1 (`/uploads/items/`); switch to S3 later        |

---

## 3. Folder structure

Layered architecture: **router → middleware → controller → service → dal → db**. Each use case has one file with the same name across every layer. A single Prisma client lives in `db.js` and is imported wherever needed.

Use cases: `menu`, `order`, `customer`, `miniapp`, `admin`.

```
spice-garden-bot/
├── .env.example
├── .gitignore
├── README.md
├── package.json
│
├── prisma/
│   ├── schema.prisma
│   └── seed.js
│
├── public/
│   └── miniapp/
│       ├── index.html              # routes to menu or cart by ?v= query
│       ├── menu.html
│       ├── cart.html
│       ├── styles.css
│       ├── telegram.js             # WebApp SDK wrapper, initData header
│       ├── api.js                  # fetch helpers
│       ├── menu.js                 # accordion + stepper logic
│       └── cart.js                 # cart rows + place-order action
│
├── uploads/                        # created at boot, not in git
│   ├── menu.jpg
│   └── items/
│
└── src/
    ├── index.js                    # entry — boots config, db, bot, api
    ├── config.js                   # env load + zod validation
    ├── db.js                       # Prisma client singleton (the only one)
    ├── logger.js                   # pino instance
    │
    ├── router/                     # Express route registration only
    │   ├── menu.js                 # GET /api/menu
    │   ├── order.js                # /api/orders/*
    │   ├── customer.js             # /api/customers/me
    │   ├── miniapp.js              # GET /api/miniapp/init
    │   └── admin.js                # /api/admin/*
    │
    ├── middleware/
    │   ├── telegramAuth.js         # verifies initData HMAC, attaches req.user
    │   ├── adminAuth.js            # X-Admin-Token gate
    │   └── error.js                # error-to-JSON converter
    │
    ├── controllers/                # parse req, call service, shape response
    │   ├── menu.js
    │   ├── order.js
    │   ├── customer.js
    │   ├── miniapp.js
    │   └── admin.js
    │
    ├── services/                   # business logic; calls dal + helpers
    │   ├── menu.js
    │   ├── order.js                # cart logic, status transitions, totals
    │   ├── customer.js
    │   ├── miniapp.js              # composes menu + cart + customer
    │   ├── upi.js                  # UPI URI + QR buffer
    │   └── notify.js               # bot.telegram.sendMessage helpers
    │
    ├── dal/                        # Prisma queries only — pure data access
    │   ├── menu.js                 # item queries (filters isAvailable)
    │   ├── order.js                # cart / order CRUD
    │   └── customer.js             # findByTelegramId, upsert
    │
    └── bot/
        ├── bot.js                  # Telegraf instance + handler registration
        ├── start.js                # /start command
        ├── viewMenu.js             # sends menu.jpg
        ├── miniappData.js          # handles message.web_app_data
        ├── confirmDetails.js       # post-Mini App details prompt
        ├── detailsWizard.js        # name → phone → address scene
        ├── payment.js              # generates and sends UPI QR
        └── admin.js                # mark-paid / reject callback handlers
```

### Layer responsibilities

- **router/** — pure Express. `router.get(...)`, `router.post(...)`. Wires middleware and points at a controller. No logic.
- **middleware/** — request-time concerns: auth, error formatting. Reusable across routes.
- **controllers/** — parse and validate the HTTP request, call a service, shape the response. Knows about `req` and `res`. Doesn't touch Prisma.
- **services/** — business logic. Composes DAL calls, computes totals, transitions order status, calls notifiers. Knows nothing about HTTP.
- **dal/** — Prisma queries, nothing else. Each function takes plain args, returns plain objects.
- **db.js** — `import { PrismaClient } from '@prisma/client'; export const db = new PrismaClient();` Imported anywhere it's needed; only one instance per process.

Bot handlers follow a similar pattern but flatter — each handler imports services directly. Telegraf already shapes the input via `ctx`, so a separate controller layer for the bot would just be ceremony.

Each use case file has the same name across every layer, so `router/order.js` → `controllers/order.js` → `services/order.js` → `dal/order.js` is the obvious trail to follow when chasing a request through the system.

---

## 4. Database schema (Prisma)

Three tables: `Item`, `Customer`, `Order`. No separate Category or OrderItem tables — categories are denormalized onto items, and order line items live as JSON on the order row.

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

model Item {
  id            Int     @id @default(autoincrement())
  categoryName  String
  name          String
  price         Int     // paise — ₹1 = 100, avoids float drift
  imageUrl      String?
  isAvailable   Boolean @default(true)
  @@index([categoryName, isAvailable])
}

model Customer {
  id              Int      @id @default(autoincrement())
  telegramUserId  BigInt   @unique     // from ctx.from.id — assigned by Telegram, not us
  name            String?
  phone           String?
  address         String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum OrderStatus {
  CART               // user is building the cart in the Mini App
  AWAITING_PAYMENT   // user tapped Place Order, UPI QR shown, admin needs to validate
  PAID               // admin tapped "Order placed successfully" — payment confirmed
  REJECTED           // admin tapped "Reject order"
}

model Order {
  id           Int          @id @default(autoincrement())
  customerId   Int          // → Customer.id, joined manually when needed
  status       OrderStatus  @default(CART)
  items        Json         // [{ itemId, quantity, priceAtTime }]
  subtotal     Int          @default(0)
  deliveryFee  Int          @default(0)
  total        Int          @default(0)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  @@index([customerId, status])
}
```

### Design notes

- **Cart = Order with status CART.** Each customer has at most one CART-status order. Find-or-create on every Mini App open.
- **No `Category` table.** Category list comes from `SELECT DISTINCT categoryName FROM items WHERE isAvailable = true`. Display order is hardcoded in app config: `CATEGORY_ORDER = ['Starters', 'Mains', 'Breads', 'Rice & biryani', ...]`.
- **`Order.items` is JSON.** Shape: `[{ itemId: number, quantity: number, priceAtTime: number }]`. Total is `sum(quantity * priceAtTime) + deliveryFee`, computed in the order service whenever items change. Cached in `subtotal`/`total` columns so reads (admin DM, customer summary) don't reparse.
- **`priceAtTime` is the snapshot we care about.** Item prices may change later, but historical orders must keep the price the customer actually paid. We don't snapshot `name` — looked up via JOIN against `items` when displaying. Important corollary: never hard-delete items from the `items` table, or old orders will display blank names. Use `isAvailable = false` to retire items instead.
- **`telegramUserId` is from Telegram.** Every user has a unique numeric ID assigned by Telegram. Telegraf hands it to you on every event as `ctx.from.id`. BigInt because the ID can exceed 32-bit. We use it as the lookup key for returning customers.
- **No FK constraints in Prisma schema.** `customerId` is a plain int. If you want database-level integrity, add the FK via a raw migration: `ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customerId) REFERENCES customers(id);`.

---

## 5. REST API

All endpoints under `/api`. Mini App routes require Telegram initData auth; admin routes require an admin token.

| Method | Path                                  | Auth     | Purpose                                                     |
| ------ | ------------------------------------- | -------- | ----------------------------------------------------------- |
| GET    | `/api/miniapp/init`                   | tma      | Bundled response: menu + cart for first paint               |
| GET    | `/api/menu`                           | tma      | Categories + available items grouped                        |
| GET    | `/api/customers/me`                   | tma      | Returns saved name/phone/address or 404                     |
| PUT    | `/api/customers/me`                   | tma      | Update name/phone/address                                   |
| POST   | `/api/orders/cart`                    | tma      | Find or create cart-status order, returns it                |
| GET    | `/api/orders/:id`                     | tma      | Returns order details (caller must own it)                  |
| POST   | `/api/orders/:id/items`               | tma      | Upsert quantity for an item in the cart                     |
| DELETE | `/api/orders/:id/items/:itemId`       | tma      | Remove item from cart                                       |
| POST   | `/api/orders/:id/place`               | tma      | CART → AWAITING_PAYMENT, returns `{ upiUri, amount, ref }`  |
| PATCH  | `/api/admin/items/:id/availability`   | admin    | `{ isAvailable: bool }`                                     |
| POST   | `/api/admin/orders/:id/mark-paid`     | admin    | AWAITING_PAYMENT → PAID, triggers customer template         |
| POST   | `/api/admin/orders/:id/reject`        | admin    | AWAITING_PAYMENT → REJECTED, notifies customer              |

**Telegram initData auth (`tma`)** — Mini App sends `Authorization: tma <initData>`. Middleware verifies HMAC-SHA256 of the data string against the bot token (per Telegram's WebApp spec), parses the user, attaches `req.user.telegramUserId`. Reject on invalid or stale (>1h) signatures.

**Admin auth** — single shared secret in `ADMIN_TOKEN` env var, sent as `X-Admin-Token` header. Or skip the HTTP admin endpoints entirely and have the bot's admin callback handlers call services directly — simpler for v1.

---

## 6. Bot behaviour

### Conversation states

| State           | Trigger                                | Bot action                                                   |
| --------------- | -------------------------------------- | ------------------------------------------------------------ |
| `/start`        | First message                          | Welcome + `[View menu]` `[Order now (web_app)]`              |
| View menu       | Tap `View menu`                        | `sendPhoto(menu.jpg)` + `[Order now]`                        |
| Open Mini App   | Tap `Order now`                        | Telegram launches Mini App with bot's web_app URL            |
| Mini App data   | Mini App calls `WebApp.sendData(...)`  | Bot receives `message.web_app_data` — handler dispatches on `intent` field (`view_cart` or `placed`) |
| Confirm details | After `view_cart` intent               | Show saved details + `[Confirm and view cart (web_app→cart)]` `[Update details]` |
| Wizard          | Tap `Update details`                   | Scene asks name → phone → address, validates phone regex     |
| Cart Mini App   | Tap `Confirm and view cart`            | Mini App opens at `/miniapp/cart.html` route                 |
| Place order     | Mini App POSTs `/orders/:id/place`     | Server flips status, returns UPI URI; bot generates QR and sends to customer; bot DMs admin chat with order summary + admin keyboard |
| Admin confirms  | Admin taps `Order placed successfully` | Order → PAID; bot sends customer "Payment confirmed... 15-30 min" |
| Admin rejects   | Admin taps `Reject order`              | Order → REJECTED; bot sends customer cancellation message    |

### Sessions

Use Telegraf's built-in in-memory session for v1. Store only ephemeral state — `current_order_id`, `wizard_step`. Persistent customer data goes in Postgres. For multi-instance deployments later, swap to `telegraf-session-redis`.

### Admin guard

All admin callback handlers wrapped in middleware that checks `ctx.chat.id === ADMIN_CHAT_ID`. Anyone else gets a silent no-op.

---

## 7. Mini App

### Pages

| Path              | Renders            | Loaded by                                                      |
| ----------------- | ------------------ | -------------------------------------------------------------- |
| `/miniapp/`       | menu (default)     | `web_app: { url: "https://yourapp/miniapp/?v=menu" }`          |
| `/miniapp/?v=cart`| cart               | `web_app: { url: "https://yourapp/miniapp/?v=cart" }`          |

Both pages share `telegram.js` and `api.js`. The "Order now" button in the bot opens menu; "Confirm and view cart" opens cart.

### Boot sequence

```
1. Page loads → window.Telegram.WebApp.ready()
2. Read WebApp.initData (signed payload, ~250 bytes)
3. Call GET /api/miniapp/init with `Authorization: tma <initData>`
4. Server verifies HMAC, returns { menu, cart, customer }
5. Render
```

### State management

- Cart is server-authoritative.
- On every quantity change, debounce 300ms then `POST /api/orders/:id/items` with `{ itemId, quantity }`.
- Local state holds the optimistic copy; on API error, revert and toast.

### Closing the Mini App

- **From menu, "View cart" tapped:** `WebApp.sendData(JSON.stringify({ intent: 'view_cart', orderId }))` — Telegram closes the Mini App and delivers the data as a message to the bot.
- **From cart, "Place order" tapped:** call `POST /api/orders/:id/place`, on success call `WebApp.sendData(JSON.stringify({ intent: 'placed', orderId }))`, then `WebApp.close()`. The bot's `web_app_data` handler then sends the QR.

### Auth on every API call

```js
// js/api.js
async function api(path, options = {}) {
  const initData = window.Telegram.WebApp.initData;
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `tma ${initData}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## 8. UPI deep-link

```
upi://pay?pa=<MERCHANT_VPA>&pn=<MERCHANT_NAME>&am=<AMOUNT_RUPEES>&cu=INR&tn=Order-<ORDER_ID>
```

`upiService.buildUri(order)` builds it. `upiService.generateQrPng(uri)` returns a Buffer via the `qrcode` package. Bot sends as `replyWithPhoto({ source: buffer })` with caption "Scan to pay ₹X · Order #N".

The transaction note (`tn`) is the order reference — admin can match payments in their UPI app to orders in the bot DM.

---

## 9. Implementation phases

Each phase ends with something testable end-to-end.

### Phase 1 — Foundation (½ day)

- `npm init`, install all deps
- `.env.example`, `config.js` with zod
- `prisma init`, write `schema.prisma`, run first migration
- `seed.js` — 10 categories, ~30 items
- `src/index.js` boots Express on port 3000, Telegraf on long-polling, both share Prisma client
- `/start` replies "Welcome" — verify bot is alive

**Done when:** `npm run dev` brings up both, `/start` works, `psql` shows seed data.

### Phase 2 — Menu API + Mini App scaffold (1 day)

- `GET /api/menu` returns categories + available items
- `telegramAuth` middleware — verify initData HMAC against bot token
- `GET /api/miniapp/init` — bundled response
- `public/miniapp/index.html` — boots, calls `/init`, renders raw JSON for now
- Bot `/start` includes a `web_app` button pointing at the Mini App URL

**Done when:** Tapping "Order now" opens the Mini App, you see the seeded menu printed as JSON.

### Phase 3 — Mini App menu UI (1–2 days)

- Port the mockup's HTML/CSS into `menu.html` + `styles.css`
- Implement accordion category list, quantity stepper, "View cart" sticky CTA
- Local cart state, debounced sync to `POST /api/orders/:id/items`
- "View cart" calls `WebApp.sendData({ intent: 'view_cart' })`

**Done when:** You can browse, add/remove items, see them persist after a page reload.

### Phase 4 — Customer details flow (½ day)

- Bot handler for `message.web_app_data` — parses `intent: 'view_cart'`
- `confirmDetails.js` — pulls saved customer, sends details message + keyboard
- `detailsWizard.js` scene — name → phone (regex) → address
- `[Confirm and view cart]` is a `web_app` button to `/miniapp/?v=cart`

**Done when:** First-time user runs the wizard; returning user sees saved details.

### Phase 5 — Cart Mini App + Place Order (1 day)

- `cart.html` — render line items, totals, sticky CTA
- `Place order` calls `POST /api/orders/:id/place`, then `WebApp.sendData({ intent: 'placed', orderId })` + `WebApp.close()`
- Server `/place` builds UPI URI, returns it; sets status `AWAITING_PAYMENT`
- Bot handles `intent: 'placed'` — calls `upiService.generateQrPng()`, sends QR photo to customer

**Done when:** Customer sees the QR; you can scan it in a UPI app and see ₹X pre-filled (with the test VPA, payment will fail — that's expected).

### Phase 6 — Admin flow (½ day)

- `notifyService.notifyAdmin(order)` — DMs `ADMIN_CHAT_ID` with summary + inline keyboard
- Bot handlers for `mark_paid_<orderId>` and `reject_<orderId>` callback queries
- Admin guard middleware — only `ADMIN_CHAT_ID` can fire these
- On `mark_paid`: status → PAID, customer gets "Payment confirmed..."
- On `reject`: status → REJECTED, customer gets cancellation note

**Done when:** Full loop works — customer places order, admin gets DM, admin taps confirm, customer gets confirmation.

### Phase 7 — Admin item availability (¼ day)

- `PATCH /api/admin/items/:id/availability` — flips `isAvailable`
- Or a simple bot command `/availability <itemId> <on|off>` for v1
- Menu queries already filter `WHERE isAvailable = true`

**Done when:** Admin can hide an item; it disappears from the next Mini App load.

### Phase 8 — Polish + deploy (1 day)

- Error handling, loading states, empty cart messaging
- Pino logging across bot + api
- README with run/deploy instructions
- Push to GitHub, set up Railway/Render, run migrations on boot, set webhook
- Smoke test end-to-end on production

**Done when:** Real users can place real orders.

**Total estimate: ~5–6 days of focused work.**

---

## 10. Environment variables

```
# .env.example
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://user:pass@localhost:5432/spice_garden

BOT_TOKEN=                  # from @BotFather
BOT_USERNAME=               # without @, used to construct miniapp URL
WEBHOOK_URL=                # prod only — public HTTPS URL
PUBLIC_URL=https://localhost:3000  # base URL the Mini App is served from

ADMIN_CHAT_ID=              # numeric Telegram chat id for the admin
ADMIN_TOKEN=                # shared secret for HTTP admin routes (optional)

MERCHANT_VPA=spicegarden@upi
MERCHANT_NAME=Spice Garden
DELIVERY_FEE_RUPEES=40

LOG_LEVEL=info
```

---

## 11. Deployment notes

- **Mini Apps require HTTPS** — Railway/Render/Fly all give that out of the box. Locally, use `ngrok http 3000` and set `PUBLIC_URL=https://<ngrok-host>` for testing.
- **Webhooks vs polling:** dev = polling, prod = webhook (`bot.telegram.setWebhook(WEBHOOK_URL + '/telegram')`). Express needs to mount the webhook handler at that path.
- **Mini App URL registration:** open `@BotFather` → `/setdomain` to whitelist your `PUBLIC_URL`. Without this, the Mini App won't open.
- **DB migrations on boot:** `prisma migrate deploy` should run as a release/start step on the host.
- **Static menu image:** drop `menu.jpg` into `/uploads` once at deploy time. Bot reads `MENU_IMAGE_PATH` env var.

---

## 12. Things explicitly out of scope for v1

- Real payment gateway (Razorpay, Cashfree) — manual admin validation is sufficient
- Multiple restaurants / multi-tenancy — single restaurant only
- Order tracking after PAID (e.g. "out for delivery") — admin handles that out-of-band
- Customer order history view — can add a `/myorders` command later
- Web admin dashboard — Telegram admin chat is enough for one operator
- Rate limiting — add when traffic justifies it
- i18n — English only

---

Ready to start on Phase 1 when you give the word.
