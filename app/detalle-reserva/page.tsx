import { PrivateRecords } from '@/components/booking/records';
export default async function DetallePage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const query = await searchParams;
  return <PrivateRecords mode="detail" id={typeof query.id === 'string' ? query.id : ''} />;
}
