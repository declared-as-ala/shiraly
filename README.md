# Shiraly — The Luxury Tunisian Brand

Next.js 14 storefront + admin console.

## Stack
- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- MongoDB (Mongoose)
- Zustand (cart)
- Cloudinary (images)
- Navex / First Delivery Group (shipping APIs)

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in the keys
npm run dev
```

Open <http://localhost:3000>.

Admin: <http://localhost:3000/admin>

## Required env vars (`.env.local`)

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ADMIN_PASSWORD` | Admin login password |
| `SESSION_SECRET` | A long random string for session signing |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (for image uploads) |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## Shipping APIs (optional)

| Variable | Description |
| --- | --- |
| `NAVEX_TOKEN_ADD` | Create Navex parcels (server-only) |
| `NAVEX_TOKEN_GET` | Track one Navex parcel (server-only) |
| `NAVEX_TOKEN_GET_MULTIPLE` | Track several Navex parcels (server-only) |
| `NAVEX_TOKEN_DELETE` | Cancel a Navex parcel (server-only) |
| `NAVEX_TOKEN_PENDING` | Retrieve pending Navex parcels (server-only) |
| `BEST_DELIVERY_*` | Best Delivery integration |

## Pages

| URL | What it does |
| --- | --- |
| `/` | Home — hero carousel + featured products |
| `/categorie/[slug]` | Category listing |
| `/produit/[slug]` | Product detail (gallery, bundles, add to cart) |
| `/panier` | Cart (Zustand + localStorage) |
| `/commande` | COD checkout |
| `/merci` | Thank-you page |
| `/shop` | Full shop with search & sort |
| `/admin` | Dashboard (revenue, orders, top products) |
| `/admin/commandes` | Orders management |
| `/admin/produits` | Products management |
| `/admin/categories` | Categories management |
| `/admin/profile` | Site info + password + hero slider manager |
| `/employee` | Employee order dashboard |
| `/employee/commandes` | Employee order list |
