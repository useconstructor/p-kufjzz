import { PrivateRecords } from '@/components/booking/records';
export default async function ConfirmacionPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const query = await searchParams;
  return <PrivateRecords mode="confirmation" id={typeof query.id === 'string' ? query.id : ''} />;
}
