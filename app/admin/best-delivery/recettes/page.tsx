import BestDeliveryList from '@/components/admin/BestDeliveryList';

export const dynamic = 'force-dynamic';

export default function BestDeliveryRecettesPage() {
  return (
    <BestDeliveryList
      endpoint="recettes"
      title="Recettes Best Delivery"
      subtitle="Suivi des paiements et recettes Best Delivery."
    />
  );
}
