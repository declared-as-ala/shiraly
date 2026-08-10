# CLAUDE.md — Shiraly Project Guide

> **Read this file first.** It is the single source of truth about architecture,
> conventions, and recurring gotchas. Following it saves tokens and avoids
> re-learning the same things on every conversation.

---

## 1. Project at a Glance

| Property | Value |
|---|---|
| App name | **Shiraly** |
| Tagline | *"The Luxury Tunisian Brand"* |
| Stack | **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS v3** · **MongoDB / Mongoose** · **Cloudinary** |
| Node requirement | ≥ 20.0.0 (see `.nvmrc`) |
| Currency | TND (DT), 0 decimal places |
| Languages | French (`fr`) — default · Arabic (`ar`) — RTL |
| Dev server | `npm run dev` (Next default port 3000) |
| Production | `npm start` binds `0.0.0.0:${PORT:-3000}` |

---

## 2. Directory Structure (annotated)

```
shirally/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout — fonts, providers, lang/dir
│   ├── page.tsx                 # Home page (hero, featured products, etc.)
│   ├── globals.css              # Global styles + Tailwind base
│   ├── QueryProvider.tsx        # React-Query provider (client boundary)
│   │
│   ├── shop/                    # /shop  — product listing + search
│   ├── produit/[slug]/          # /produit/:slug — PDP (product detail page)
│   ├── categorie/[slug]/        # /categorie/:slug — category pages
│   ├── panier/                  # /panier — cart page
│   ├── commande/                # /commande — checkout
│   ├── wishlist/                # /wishlist — wishlist page
│   ├── contact/                 # /contact — contact page
│   ├── merci/                   # /merci — thank-you after order
│   │
│   ├── admin/                   # Admin panel (protected by middleware)
│   │   ├── layout.tsx           # Admin shell layout
│   │   ├── page.tsx             # Dashboard with charts
│   │   ├── produits/            # Product CRUD
│   │   ├── categories/          # Category CRUD
│   │   ├── commandes/           # Order management
│   │   ├── promo-codes/         # Promo code management
│   │   ├── best-delivery/       # Best Delivery integration page
│   │   ├── profile/             # Admin profile / password change
│   │   └── navex/               # Navex shipping panel
│   │
│   ├── admin-login/             # /admin-login — login page (not protected)
│   │
│   └── api/                     # API routes (Next Route Handlers)
│       ├── auth/                # login/logout endpoints
│       ├── admin/
│       │   ├── upload/route.ts  # POST — image upload (Cloudinary → WP fallback)
│       │   ├── products/        # admin product CRUD
│       │   ├── categories/      # admin category CRUD
│       │   ├── orders/          # admin order management
│       │   ├── promo-codes/     # promo code CRUD
│       │   ├── users/           # admin user management
│       │   ├── profile/         # admin profile
│       │   ├── site-settings/   # site settings (contact info, photo)
│       │   ├── best-delivery/   # Best Delivery SOAP proxy
│       │   ├── navex/           # Navex REST proxy
│       │   └── order-statuses/  # order status management
│       ├── products/search/     # public product search
│       ├── orders/              # public order creation
│       ├── slides/              # hero slides
│       └── promo/               # promo code validation (public)
│
├── components/
│   ├── admin/                   # Admin-only UI components
│   │   ├── ImageUploader.tsx    # Drag/click upload → POST /api/admin/upload
│   │   ├── ProductDrawer.tsx    # Full product create/edit drawer (34 KB!)
│   │   ├── OrderDrawer.tsx      # Order detail / status drawer (43 KB!)
│   │   ├── CommandesView.tsx    # Orders list view
│   │   ├── ProduitsView.tsx     # Products list view
│   │   ├── CategoriesView.tsx   # Categories list view
│   │   ├── PromoCodesView.tsx   # Promo codes list
│   │   ├── ProfileView.tsx      # Admin profile settings
│   │   ├── DashboardCharts.tsx  # Recharts dashboard
│   │   ├── BestDeliveryPanel.tsx# Best Delivery UI
│   │   ├── NavexPanel.tsx       # Navex UI
│   │   ├── Sidebar.tsx          # Admin sidebar nav
│   │   ├── Drawer.tsx           # Generic drawer wrapper
│   │   ├── Toast.tsx            # Toast notifications (useToast hook)
│   │   └── NumberField.tsx      # Numeric input with +/- buttons
│   │
│   ├── site/                    # Public storefront components
│   │   ├── Header.tsx           # Site header / nav
│   │   ├── HomeNavbar.tsx       # Home-specific navbar
│   │   ├── Hero.tsx             # Hero section
│   │   ├── Footer.tsx           # Site footer
│   │   ├── ProductCard.tsx      # Product card (uses raw img.url — see §8)
│   │   ├── ProductGallery.tsx   # PDP image gallery
│   │   ├── AddToCart.tsx        # Add-to-cart / bundle selector
│   │   ├── CartDrawer.tsx       # Sliding cart panel (Zustand)
│   │   ├── SearchOverlay.tsx    # Search modal
│   │   ├── LanguageProvider.tsx # Lang context (fr/ar)
│   │   ├── LanguageSwitcher.tsx # FR/AR toggle
│   │   ├── SiteConfigContext.tsx# Contact info context
│   │   └── WishlistButton.tsx   # Heart icon / wishlist toggle
│   │
│   └── NavProgress.tsx          # Top navigation progress bar
│
├── lib/                         # Server-side and shared utilities
│   ├── auth.ts                  # HMAC session sign/verify (Node crypto only)
│   ├── auth-shared.ts           # Cookie names + lightweight cookie check (Edge-safe)
│   ├── mongodb.ts               # Mongoose connection singleton
│   ├── models/                  # Mongoose models
│   │   ├── Product.ts
│   │   ├── Category.ts
│   │   ├── Order.ts
│   │   ├── AdminUser.ts
│   │   ├── Employee.ts
│   │   ├── PromoCode.ts
│   │   └── SiteSetting.ts
│   ├── admin-storage.ts         # Site settings + admin password (Mongo + file fallback)
│   ├── admin-users.ts           # Admin user CRUD (Mongo + file fallback)
│   ├── employee-storage.ts      # Employee store (file-backed, Phase 1)
│   ├── i18n.ts                  # All UI strings (fr + ar dictionaries) + normalizeLang
│   ├── i18n-server.ts           # Server-side i18n helper
│   ├── site-config.ts           # SITE constants, formatPrice, normalizeImageUrl
│   ├── cart.tsx                 # Zustand cart store
│   ├── cart-ui.ts               # Cart UI state
│   ├── wishlist.ts              # Zustand wishlist store
│   ├── promo-calculator.ts      # Promo discount logic
│   ├── best-delivery.ts         # Best Delivery SOAP client (15 KB)
│   ├── navex.ts                 # Navex REST client (10 KB)
│   ├── round-robin.ts           # Load-balancing helper
│   ├── delivery-idempotency.ts  # Idempotency key for delivery requests
│   └── seo-score.ts             # SEO scoring utility
│
├── services/                    # Data access layer (interfaces + Mongo implementations)
│   ├── index.ts                 # Exports singleton service instances
│   ├── product-service.ts       # ProductService interface
│   ├── category-service.ts      # CategoryService interface
│   ├── order-service.ts         # OrderService interface
│   ├── promo-service.ts         # PromoService interface
│   └── mongo/                   # MongoDB implementations
│
├── types/                       # Shared TypeScript types
├── data/                        # Local file fallback (admin.json, employees.json, etc.)
├── public/                      # Static assets
├── middleware.ts                 # Edge middleware — admin auth guard
├── next.config.mjs              # Next.js config (image remote patterns, serverActions)
├── tailwind.config.js           # Tailwind config (custom colors, fonts)
├── .env.local                   # Local secrets (never commit)
└── .env.example                 # Env var template with comments
```

---

## 3. Environment Variables

All secrets live in `.env.local` (gitignored). Copy `.env.example` to set up.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_NAME` | public | Site display name |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL |
| `NEXT_PUBLIC_CURRENCY_CODE` | public | `TND` |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | public | `DT` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | **public** | Cloudinary cloud for client-side URL expansion — **add this if missing** |
| `MONGODB_URI` | server | MongoDB Atlas connection string |
| `CLOUDINARY_CLOUD_NAME` | server | Cloudinary cloud name (`dhugyagpb`) |
| `CLOUDINARY_API_KEY` | server | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | server | Cloudinary API secret |
| `SESSION_SECRET` | server | HMAC key for session cookies (32 bytes min) |
| `ADMIN_PASSWORD` | server | Bootstrap admin password (optional once set in DB) |
| `ADMIN_EMAIL` | server | Bootstrap admin email |
| `BEST_DELIVERY_LOGIN` | server | Best Delivery SOAP credentials |
| `BEST_DELIVERY_PASSWORD` | server | Best Delivery SOAP credentials |
| `BEST_DELIVERY_WSDL_URL` | server | SOAP WSDL URL |
| `BEST_DELIVERY_PROXY_URL` | server | JSON proxy URL |
| `NAVEX_API_BASE` | server | `https://app.navex.tn` |
| `NAVEX_TOKEN_ADD` | server | Navex add-parcel token |
| `NAVEX_TOKEN_GET` | server | Navex get-status token |
| `NAVEX_TOKEN_GET_MULTIPLE` | server | Navex get-multiple token |
| `NAVEX_TOKEN_DELETE` | server | Navex delete token |
| `NAVEX_TOKEN_PENDING` | server | Navex pending token |

> **Rule**: only `NEXT_PUBLIC_*` vars are available in browser bundles.
> Server-only vars (`CLOUDINARY_*`, `MONGODB_URI`, etc.) must never be exposed client-side.

---

## 4. Authentication & Sessions

### Cookie names
- `shiraly_session` — new format: HMAC-signed JSON `{ role, userId, name }`
- `shiraly_admin` — legacy format: HMAC-signed literal string `"admin"`

### Two-layer verification
| Layer | File | What it does |
|---|---|---|
| Edge (middleware) | `lib/auth-shared.ts` · `cookieLooksValid()` | Structural check only — no Node crypto |
| Server (API/RSC) | `lib/auth.ts` · `verify()` | Full HMAC verification with `crypto` |

### Session helpers
```ts
import { getSession, isAdmin, currentUserId } from '@/lib/auth';

const session = await getSession(); // Session | null
const ok      = await isAdmin();   // boolean
const uid     = await currentUserId(); // string | null
```

### Roles
- `admin` — full access
- `employee` — limited access (order management only)

### Admin guard in API routes
```ts
if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
```

### Middleware matcher
Only `/admin/:path*` is matched. `/admin-login` is explicitly excluded.

---

## 5. Data Layer

### MongoDB (primary)
All domain data (products, categories, orders, promo codes, admin users, site settings)
lives in MongoDB Atlas. Connection is managed by `lib/mongodb.ts` — a global-cached
Mongoose connection that skips connecting when `MONGODB_URI` is not set.

### File fallback (secondary)
`lib/admin-storage.ts` and `lib/employee-storage.ts` write JSON files to `data/`.
This is a safety net for environments where Mongo is unavailable. On Vercel / read-only
filesystems, only the Mongo path works.

### Service layer pattern
```
services/index.ts                  → exposes singletons
services/product-service.ts        → interface (TypeScript)
services/mongo/mongo-product-service.ts → Mongo implementation
```

Always import from `@/services` — never use Mongoose models directly in route handlers.

### Key Mongoose models

| Model | File | Key fields |
|---|---|---|
| `Product` | `lib/models/Product.ts` | `slug`, `name`, `status`, `images[]`, `hoverImage`, `bundles[]`, `categoryIds[]` |
| `Category` | `lib/models/Category.ts` | `slug`, `name`, `parentId` |
| `Order` | `lib/models/Order.ts` | `orderNumber`, `status`, `items[]`, `customer`, `deliveryService` |
| `AdminUser` | `lib/models/AdminUser.ts` | `email`, `name`, `role`, `passwordHash`, `salt` |
| `PromoCode` | `lib/models/PromoCode.ts` | `code`, `discountType`, `value`, `minOrder`, `usageLimit` |
| `SiteSetting` | `lib/models/SiteSetting.ts` | `key`, `value` (generic KV store) |

---

## 6. Image Handling — **READ CAREFULLY** ⚠️

This is the most common source of bugs.

### How images are stored
Images uploaded via `/api/admin/upload` are saved to **Cloudinary** and the
`secure_url` (full `https://res.cloudinary.com/...`) is stored in the DB.

However, older data or manual imports may store **bare public IDs** like
`lfidyisds9lxs38sdwnj.jpg` without the full URL prefix.

### The 401 error
When a bare public ID is used as an `<img src>`, the browser requests
`GET /lfidyisds9lxs38sdwnj.jpg` — a relative URL on the Next.js server.
Next.js has no such route and the admin middleware returns **401** for paths
that look like admin routes, or 404 otherwise. This is **not** a permission
issue — the image URL is simply malformed.

### Fix: always use `normalizeImageUrl`
```ts
import { normalizeImageUrl } from '@/lib/site-config';

// Works for both full URLs and bare public IDs:
// "https://res.cloudinary.com/..." → returned as-is
// "lfidyisds9lxs38sdwnj.jpg"      → expanded to Cloudinary URL
const src = normalizeImageUrl(product.images[0]?.url);
```

### Client-side image URL expansion
`normalizeImageUrl` reads `process.env.CLOUDINARY_CLOUD_NAME` which is a
**server-only** variable. For client components, it also falls back to
`process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. Make sure this public var
is set in `.env.local`:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dhugyagpb
```

### Next.js `<Image>` vs `<img>`
- Admin panel uses bare `<img>` tags (simpler, no domain config needed for internal).
- Storefront uses bare `<img>` tags too (see `ProductCard.tsx`).
- `next.config.mjs` allows all remote patterns (`**`) so `<Image>` works for any host.

### Upload flow
1. `ImageUploader.tsx` (client) → `POST /api/admin/upload` (multipart)
2. Route handler checks `isAdmin()`, then calls Cloudinary SDK.
3. On success returns `{ id: public_id, url: secure_url }`.
4. Client stores `url` (the full HTTPS URL) in the product/category state.
5. **Always persist the full `secure_url`, never the bare public ID.**

---

## 7. i18n (Internationalisation)

Languages: **French** (`fr`, default) and **Arabic** (`ar`, RTL).

### Dictionary
All strings are in `lib/i18n.ts` in a single `dictionaries` object.
```ts
import { getDictionary } from '@/lib/i18n';
const t = getDictionary(lang); // lang: 'fr' | 'ar'
t.nav.home  // 'Accueil' | 'الرئيسية'
```

### Lang cookie
Cookie name: `shiraly-lang`. Set by the `LanguageSwitcher` component.

### HTML dir / lang
Set in `app/layout.tsx` based on `normalizeLang(cookieStore.get(LANG_COOKIE))`.
`ar` → `dir="rtl"`, everything else → `dir="ltr"`.

### RTL-aware CSS
Use Tailwind logical properties: `ps-4` (padding-inline-start), `me-2` (margin-inline-end),
`start-0` (inset-inline-start), `end-0` (inset-inline-end) — not `pl-`, `pr-`, `ml-`, `mr-`.

---

## 8. Delivery Integrations

### Best Delivery (SOAP)
- Client: `lib/best-delivery.ts`
- API proxy: `app/api/admin/best-delivery/`
- Credentials: `BEST_DELIVERY_LOGIN`, `BEST_DELIVERY_PASSWORD`
- WSDL: `BEST_DELIVERY_WSDL_URL`

### Navex (REST)
- Client: `lib/navex.ts`
- API proxy: `app/api/admin/navex/`
- Base URL: `NAVEX_API_BASE=https://app.navex.tn`
- Multiple tokens by operation type (add, get, delete, pending)

Both integrations are **backend-only** — tokens/passwords must never reach the browser.

---

## 9. Promo Codes

Logic lives entirely in `lib/promo-calculator.ts`. The validator endpoint is
`app/api/promo/` (public). Admin CRUD is at `app/api/admin/promo-codes/`.

Discount types: `percentage` | `fixed`. Supports `minOrder`, `usageLimit`,
`startDate`, `endDate`, `applicableProductIds`.

---

## 10. Cart & Wishlist (Client State)

| Store | File | Persistence |
|---|---|---|
| Cart | `lib/cart.tsx` (Zustand) | `localStorage` |
| Wishlist | `lib/wishlist.ts` (Zustand) | `localStorage` |
| Cart UI | `lib/cart-ui.ts` (Zustand) | in-memory (open/close state) |

Access pattern:
```ts
import { useCart } from '@/lib/cart';
const { items, addItem, removeItem, clearCart } = useCart();
```

---

## 11. Styling Conventions

- **Framework**: Tailwind CSS v3 with custom tokens
- **Font variables**: `--font-inter` · `--font-playfair` · `--font-cairo`
- **Custom color tokens** (defined in `tailwind.config.js`):
  - `brand-*` — primary brand color (warm caramel / gold)
  - `ink-*` — neutral dark tones
  - `sand-*` — warm beige tones
- **shadow-card** — product card hover shadow utility
- RTL: always use logical Tailwind properties (`ps`, `pe`, `ms`, `me`, `start`, `end`)
- Admin panel uses `ink-*` / `brand-*` colour palette, no external UI library

---

## 12. Key Gotchas & Rules

1. **Image URLs**: Always call `normalizeImageUrl(url)` before rendering any
   image that might be a bare Cloudinary public ID. Bare IDs cause 401/404 errors.

2. **`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`**: This env var must be set in `.env.local`
   for client components to resolve bare image IDs. Server-only `CLOUDINARY_CLOUD_NAME`
   is invisible to the browser.

3. **`auth.ts` is server-only** (`import 'server-only'` pattern via Node crypto).
   Never import it in client components or middleware — use `auth-shared.ts` there.

4. **Middleware uses Edge runtime** — only `auth-shared.ts` is allowed. Node APIs
   (`crypto.createHmac`, `fs`, etc.) are unavailable.

5. **`admin-storage.ts` and `employee-storage.ts`** import `'server-only'`. Never
   import them in client components.

6. **MongoDB connection**: `lib/mongodb.ts` silently no-ops when `MONGODB_URI` is
   missing. Always check logs for `[mongodb] MONGODB_URI not set` if data seems missing.

7. **File fallback is write-only on serverless**: `data/*.json` files may not persist
   across Vercel deployments. Always prefer MongoDB for persistent data.

8. **`SESSION_SECRET`** must be consistent across deployments. Rotating it invalidates
   all existing sessions (users get logged out).

9. **Order numbers**: generated server-side in the order creation route. Do not
   generate them client-side.

10. **Currency**: always use `formatPrice(value)` from `lib/site-config.ts` for display.
    It rounds to 0 decimals and appends `DT`.

11. **RTL**: when adding new UI, test both `fr` and `ar` directions. Use Tailwind
    logical properties everywhere.

12. **Large components**: `ProductDrawer.tsx` (34 KB) and `OrderDrawer.tsx` (43 KB)
    are intentionally large client components. Avoid splitting unless necessary —
    they share a lot of local state.

13. **`next.config.mjs` serverActions**: `allowedOrigins: ['*']` is set for dev.
    Restrict this in production if security is a concern.

---

## 13. Common Tasks — Quick Reference

### Add a new admin API route
```
app/api/admin/<feature>/route.ts
```
Always start with:
```ts
if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
```

### Add a new public API route
No auth check needed. Import from `@/services` for data access.

### Add a new page to the admin panel
1. Create `app/admin/<feature>/page.tsx` (Server Component).
2. Add a link to `components/admin/Sidebar.tsx`.
3. The middleware automatically protects all `/admin/*` routes.

### Add a new product field
1. Add to `lib/models/Product.ts` (Mongoose schema).
2. Add to the TypeScript type in `types/`.
3. Update `components/admin/ProductDrawer.tsx` for the edit UI.
4. Update the relevant service in `services/mongo/`.

### Add translations for a new string
Add to both `fr` and `ar` blocks in `lib/i18n.ts`. Never hardcode French or
Arabic strings in components — always use `getDictionary(lang)`.

### Debug image 401 errors
Symptom: `<imageid>.jpg:1 Failed to load resource: 401`
Fix: Wrap the image URL with `normalizeImageUrl()` from `@/lib/site-config`.
Make sure `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dhugyagpb` is in `.env.local`.

---

## 14. File Path Aliases

Configured in `tsconfig.json`:
```
@/  →  ./  (project root)
```

Examples:
- `@/lib/auth` → `lib/auth.ts`
- `@/components/admin/Toast` → `components/admin/Toast.tsx`
- `@/services` → `services/index.ts`

---

## 15. Running & Debugging

```bash
# Install dependencies
npm install

# Development server (hot reload)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build (do NOT run unless user asks)
npm run build
npm start
```

Logs to watch:
- `[mongodb] MONGODB_URI not set` — DB not connected, data won't persist
- `[upload] Cloudinary error` — Cloudinary config missing or wrong
- `401` on image requests — bare Cloudinary public ID used without normalizing

---

## 16. What NOT to Do

- ❌ Do not import `lib/auth.ts` in middleware or client components.
- ❌ Do not use `mr-`, `ml-`, `pl-`, `pr-` — use RTL-safe logical properties instead.
- ❌ Do not hardcode strings in components — add them to `lib/i18n.ts`.
- ❌ Do not store bare Cloudinary public IDs — always store the full `secure_url`.
- ❌ Do not expose server env vars to the client — only `NEXT_PUBLIC_*` is safe.
- ❌ Do not call Mongoose models directly from route handlers — use services layer.
- ❌ Do not run `npm run build` unless explicitly asked.
- ❌ Do not add a new UI library — Tailwind + Lucide React is sufficient.
- ❌ Do not modify `.env.local` — suggest changes to the user instead.
