'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Tag, LogOut, UserCircle, Menu, X, Truck, Receipt } from 'lucide-react';

const items = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/commandes', label: 'Commandes', icon: ShoppingCart },
  { href: '/admin/produits', label: 'Produits', icon: Package },
  { href: '/admin/categories', label: 'Catégories', icon: Tag },
  { href: '/admin/best-delivery/orders', label: 'Best Delivery', icon: Truck },
  { href: '/admin/best-delivery/recettes', label: 'Recettes', icon: Receipt },
  { href: '/admin/profile', label: 'Profil', icon: UserCircle },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on route change.
  useEffect(() => { setOpen(false); }, [path]);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/admin-login');
  }

  const nav = (
    <>
      <div className="mb-8 flex items-center gap-3 p-2">
        <Image src="/star-logo.svg" alt="Shiraly" width={36} height={36} className="h-9 w-auto" />
        <div>
          <strong className="block">Shiraly Admin</strong>
          <small className="text-brand-200">Store manager</small>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((it) => {
          const active = it.exact ? path === it.href : path.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition ${active ? 'bg-white text-brand-700' : 'text-white hover:bg-white/10'}`}>
              <Icon size={18} /> {it.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={logout} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-white/80 hover:bg-white/10">
        <LogOut size={18} /> Déconnexion
      </button>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-900 px-4 py-3 text-white lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/star-logo.svg" alt="Shiraly" width={28} height={28} className="h-7 w-auto" />
          <strong>Shiraly Admin</strong>
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10">
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col bg-gradient-to-b from-brand-700 to-brand-900 p-4 text-white lg:flex">
        {nav}
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-ink-900/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside className={`absolute inset-y-0 start-0 flex w-72 max-w-[85%] flex-col bg-gradient-to-b from-brand-700 to-brand-900 p-4 text-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'}`}>
          <button onClick={() => setOpen(false)} aria-label="Fermer" className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/10">
            <X size={20} />
          </button>
          {nav}
        </aside>
      </div>
    </>
  );
}
