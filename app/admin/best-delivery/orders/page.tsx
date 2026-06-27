import BestDeliveryList from '@/components/admin/BestDeliveryList';

export const dynamic = 'force-dynamic';

export default function BestDeliveryOrdersPage() {
  return (
    <BestDeliveryList
      endpoint="orders"
      title="Commandes Best Delivery"
      subtitle="Liste des commandes synchronisées avec Best Delivery."
    />
  );
}
