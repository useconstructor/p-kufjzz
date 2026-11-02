import { PrivateRecords } from '@/components/booking/records';
export default async function CodigoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <PrivateRecords mode="detail" codigo={codigo} />;
}
