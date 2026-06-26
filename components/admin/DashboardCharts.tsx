'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, ArrowUpRight } from 'lucide-react';

const COLORS = ['#8B5E34', '#6B4423', '#A07B5E', '#D9C7B8', '#C4AD9C', '#BFA58F'];
const PIE_COLORS = ['#8B5E34', '#6B4423', '#A07B5E', '#D9C7B8', '#C4AD9C'];

type DashboardData = {
  revenue: number;
  orderCount: number;
  productCount: number;
  aov: number;
  completion: number;
  lowStockCount: number;
  revenueChange: number;
  orderChange: number;
  weeklyRevenue: { day: string; revenue: number; orders: number }[];
  statusCounts: Record<string, number>;
  topProducts: { name: string; qty: number }[];
  categoryDistribution: { name: string; count: number }[];
  monthlyComparison: { month: string; revenue: number; cost: number }[];
};

function KpiCard({ label, value, icon: Icon, change, changeLabel, accent }: {
  label: string; value: string; icon: any; change?: number; changeLabel?: string; accent?: boolean;
}) {
  const positive = change != null && change >= 0;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${accent ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-sand-50' : 'border border-ink-200 bg-white text-ink-900'}`}>
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/4 -translate-y-1/4 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${accent ? 'text-sand-50/70' : 'text-ink-500'}`}>{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent ? 'bg-white/10 text-sand-50' : 'bg-brand-50 text-brand-600'}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="relative mt-3 text-2xl font-black tracking-tight">{value}</p>
      {change != null && (
        <p className={`relative mt-1.5 flex items-center gap-1 text-xs font-bold ${positive ? (accent ? 'text-emerald-300' : 'text-emerald-600') : 'text-red-500'}`}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(change)}% {changeLabel || (positive ? 'vs mois dernier' : 'vs mois dernier')}
        </p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-ink-500 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function DashboardCharts({ data }: { data: DashboardData }) {
  const [chartView, setChartView] = useState<'revenue' | 'orders'>('revenue');

  const statusEntries = Object.entries(data.statusCounts);
  const totalStatus = statusEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <>
      {/* KPI Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenu total"
          value={`${Math.round(data.revenue).toLocaleString()} DT`}
          icon={DollarSign}
          change={data.revenueChange}
          accent
        />
        <KpiCard
          label="Commandes"
          value={String(data.orderCount)}
          icon={ShoppingCart}
          change={data.orderChange}
        />
        <KpiCard
          label="Panier moyen"
          value={`${Math.round(data.aov).toLocaleString()} DT`}
          icon={ArrowUpRight}
        />
        <KpiCard
          label="Produits"
          value={String(data.productCount)}
          icon={Package}
          change={data.lowStockCount > 0 ? -data.lowStockCount : undefined}
          changeLabel="en stock faible"
        />
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {/* Revenue / Orders Chart */}
        <div className="card col-span-2 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-ink-900">Aperçu</h2>
            <div className="flex gap-1 rounded-lg bg-sand-100 p-0.5">
              <button onClick={() => setChartView('revenue')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${chartView === 'revenue' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>Revenu</button>
              <button onClick={() => setChartView('orders')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${chartView === 'orders' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>Commandes</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyRevenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5E34" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8B5E34" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6B4423" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#6B4423" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5EDE6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B5846' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B5846' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                {chartView === 'revenue' ? (
                  <Area type="monotone" dataKey="revenue" name="Revenu" stroke="#8B5E34" strokeWidth={2} fill="url(#revGrad)" />
                ) : (
                  <Area type="monotone" dataKey="orders" name="Commandes" stroke="#6B4423" strokeWidth={2} fill="url(#ordGrad)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Pie */}
        <div className="card p-6">
          <h2 className="mb-5 text-sm font-black uppercase tracking-wide text-ink-900">Statuts</h2>
          <div className="flex h-52 items-center justify-center">
            {statusEntries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusEntries.map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={3} dataKey="value">
                    {statusEntries.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-ink-500">Aucune commande</p>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {statusEntries.map(([k, v], i) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="font-semibold capitalize text-ink-900">{k}</span>
                </span>
                <span className="font-bold text-ink-500">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <div className="card p-6">
          <h2 className="mb-5 text-sm font-black uppercase tracking-wide text-ink-900">Top Produits</h2>
          {data.topProducts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5EDE6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6B5846' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B5846' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="qty" name="Vendus" fill="#8B5E34" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ink-500">Pas encore de ventes.</p>
          )}
        </div>

        {/* Category Distribution */}
        <div className="card p-6">
          <h2 className="mb-5 text-sm font-black uppercase tracking-wide text-ink-900">Catégories</h2>
          {data.categoryDistribution.length > 0 ? (
            <div className="space-y-3">
              {data.categoryDistribution.map((c, i) => {
                const max = Math.max(...data.categoryDistribution.map((x) => x.count));
                const pct = max > 0 ? (c.count / max) * 100 : 0;
                return (
                  <div key={c.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink-900">{c.name}</span>
                      <span className="text-xs font-bold text-ink-500">{c.count} produits</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sand-200">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ink-500">Aucune catégorie.</p>
          )}
        </div>
      </div>
    </>
  );
}
