import { promoService } from '@/services';
import { notFound } from 'next/navigation';
import PromoCodeForm from '@/components/admin/PromoCodeForm';

export const dynamic = 'force-dynamic';

export default async function EditPromoCodePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const promo = await promoService.getById(params.id);
  if (!promo) notFound();
  return <PromoCodeForm promo={promo} />;
}
