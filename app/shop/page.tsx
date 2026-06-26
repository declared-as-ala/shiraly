import { redirect } from 'next/navigation';

// The shopping experience now lives on the homepage (#products).
// Keep this route for backward compatibility with old links/bookmarks.
export default function ShopRedirect() {
  redirect('/#products');
}
