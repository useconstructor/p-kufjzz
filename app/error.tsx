'use client';
import Link from 'next/link';
import { BrandNotice, BrandPage } from '@/components/brand';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <BrandPage title="Esta página necesita otro intento."><BrandNotice kind="error" title="No pudimos completar la carga." action={<button type="button" className="brand-button" onClick={reset}>Volver a intentar</button>}><p>Puedes intentar de nuevo o volver al inicio.</p></BrandNotice><Link href="/" className="brand-link">Volver al inicio</Link></BrandPage>;
}
