'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandPage, BrandNotice, CraftStudy } from '@/components/brand';
import { Action, ContextMedia, textLinkClass } from '@/components/booking/primitives';
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
  return <BrandPage title="Barro, torno y color." subtitle="Un asa, un borde, una huella. Elige cómo darle forma a tu pausa.">
    <div className="w-full">
      {loading && <p role="status">Consultando los talleres disponibles…</p>}
      {error && <BrandNotice kind="error" title="No pudimos cargar los talleres" action={<Action onClick={() => setAttempt(n => n + 1)}>Reintentar catálogo</Action>}><p>{error}</p></BrandNotice>}
      {catalog && <>
        <section aria-labelledby="material-title" className="mb-5 grid items-start gap-5 border-t border-brand-primary/30 pt-4 md:mb-8 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pt-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-brand-accent">Cuaderno de técnicas</p>
            <h2 id="material-title" className="mt-2 max-w-lg font-heading text-3xl leading-[1.08] tracking-[-.035em] text-brand-primary md:text-4xl">Las manos encuentran el ritmo.</h2>
            <p className="mt-3 max-w-lg leading-6">Levantar una pared, centrar el barro, explorar una superficie. Tres maneras de mirar el material; dos horas para pensar con las manos.</p>
            <figure className="mt-4 border-y border-brand-accent/40 bg-brand-accent/[.07] px-3 py-3 md:mt-6 md:p-5">
              <div className="grid grid-cols-3 items-end gap-2">{catalog.opciones.map(option => <div key={option.id} className="min-w-0"><CraftStudy name={option.nombre} className="!w-full" /><p className="mt-1 text-xs font-semibold leading-4 text-brand-primary">{option.nombre}</p></div>)}</div>
              <figcaption className="mt-3 text-xs leading-4 text-brand-muted">Estudios originales de las técnicas, no resultados garantizados. El secado y la cocción tienen sus propios tiempos: las 2 h no equivalen a una pieza terminada y lista para llevar.</figcaption>
            </figure>
          </div>
          {catalog.opciones[0]?.recursos[0] && <ContextMedia resource={catalog.opciones[0].recursos[0]} variant="hero" />}
        </section>
        <div className="mb-4 grid gap-2 border-l-4 border-brand-accent pl-4 md:grid-cols-[1.1fr_1fr] md:gap-10">
          <p className="text-sm leading-5">120 min para explorar · De 1 a 4 asistentes por reserva · 8 plazas por taller y turno. Martes a domingo: 10:00, 14:00 y 17:00, hora de Colombia · America/Bogota.</p>
          <p className="text-xs leading-5 text-brand-muted">Vuelta es un taller ficticio en Laureles, Medellín. Experiencias y precios de demostración; no se realizan pagos ni se envían mensajes.</p>
        </div>
        <div className="border-t-2 border-brand-primary">{catalog.opciones.map((option, index) => <article key={option.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-brand-primary/30 py-4 md:grid-cols-[48px_minmax(0,1fr)_220px] md:gap-6 md:py-6"><div><span aria-hidden="true" className="font-heading text-lg text-brand-accent">0{index + 1}</span></div><div><h2 className="font-heading text-3xl text-brand-primary">{option.nombre}</h2><p className="mt-2 max-w-prose leading-6">{option.descripcion}</p></div><div className="col-start-2 md:col-start-auto"><p className="text-xl font-semibold">{new Intl.NumberFormat('es-CO').format(option.precio)} {catalog.moneda}</p><p className="mt-1 text-sm">Por persona · {option.duracionMinutos / 60} h · Precio de ejemplo</p><Link className={textLinkClass + ' mt-3 text-brand-primary'} href={bookingHref(option.id)}>Elegir este taller →</Link></div></article>)}</div>
        {!catalog.opciones.length && <p role="status" className="py-6">No hay talleres publicados en este momento.</p>}
      </>}
      <p className="mt-6 text-sm text-brand-muted">La disponibilidad se consulta al elegir fecha. No se realizan pagos ni se envían mensajes.</p>
    </div>
  </BrandPage>;
}
