import { promoService } from '@/services';
import PromoCodesView from '@/components/admin/PromoCodesView';

export const dynamic = 'force-dynamic';

export default async function PromoCodesPage(props: { searchParams?: Promise<{ page?: string; search?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = Number(searchParams?.page) || 1;
  const result = await promoService.list({ page, perPage: 20, sort: 'createdAt', order: 'desc' }).catch(() => ({
    items: [], total: 0, totalPages: 0, page: 1,
  }));
  return (
    <PromoCodesView
      initialPromos={result.items}
      total={result.total}
      totalPages={result.totalPages}
      page={result.page}
    />
  );
}
