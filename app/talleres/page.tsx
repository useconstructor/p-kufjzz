'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandPage, BrandNotice } from '@/components/brand';
import { Action, ContextMedia, PhotoCredit, textLinkClass } from '@/components/booking/primitives';
import { fetchPublicCatalog, bookingHref, type BusinessCatalog } from '@/lib/client/booking/business';

export default function TalleresPage() {
  const [catalog, setCatalog] = useState<BusinessCatalog | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setCatalog(null);
    void fetchPublicCatalog().then(value => { if (live) setCatalog(value); }).catch(issue => { if (live) setError(issue instanceof Error ? issue.message : 'No pudimos consultar los talleres.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);
  return <BrandPage title="Barro, torno y color." subtitle="Elige cómo darle forma a tu pausa. Talleres y precios de demostración en Laureles, Medellín.">
    <div className="max-w-5xl">
      <p className="mb-5 border-l-4 border-brand-accent pl-4 text-base">Dos horas para explorar · De 1 a 4 asistentes por reserva · 8 plazas por taller y turno. Martes a domingo: 10:00, 14:00 y 17:00, hora de Colombia.</p>
      {loading && <p role="status">Consultando los talleres disponibles…</p>}
      {error && <BrandNotice kind="error" title="No pudimos cargar los talleres" action={<Action onClick={() => setAttempt(n => n + 1)}>Reintentar catálogo</Action>}><p>{error}</p></BrandNotice>}
      {catalog && <>
        {catalog.opciones[0]?.recursos[0] && <div className="mb-6 grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[180px_1fr]"><ContextMedia resource={catalog.opciones[0].recursos[0]} variant="compact" /><p className="text-sm leading-5">Las manos y el barro como punto de partida. Esta fotografía representativa del proceso se comparte entre los talleres; no muestra clientes ni resultados de Vuelta.</p></div>}
        <div className="border-t-2 border-brand-primary">{catalog.opciones.map((option, index) => <article key={option.id} className="grid gap-4 border-b border-brand-primary/30 py-6 sm:grid-cols-[60px_1fr_220px] sm:gap-6"><span aria-hidden="true" className="font-heading text-3xl text-brand-accent">0{index + 1}</span><div><h2 className="font-heading text-3xl text-brand-primary">{option.nombre}</h2><p className="mt-3 max-w-prose leading-6">{option.descripcion}</p></div><div><p className="text-xl font-semibold">{new Intl.NumberFormat('es-CO').format(option.precio)} {catalog.moneda}</p><p className="mt-1 text-sm">Por persona · {option.duracionMinutos / 60} h · Precio de ejemplo</p><Link className={textLinkClass + ' mt-3 text-brand-primary'} href={bookingHref(option.id)}>Elegir este taller →</Link></div></article>)}</div>
        {!catalog.opciones.length && <p role="status" className="py-6">No hay talleres publicados en este momento.</p>}
        <PhotoCredit className="mt-6" />
      </>}
      <p className="mt-6 text-sm text-brand-muted">La disponibilidad se consulta al elegir fecha. No se realizan pagos ni se envían mensajes.</p>
    </div>
  </BrandPage>;
}
