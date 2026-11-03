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
        <p className="mb-4 text-sm text-brand-muted">Tres experiencias demo · 2 h · Precios por persona. Elige un taller para consultar fecha y cupo.</p>
        <div className="border-t-2 border-brand-primary">{catalog.opciones.map((option, index) => <article key={option.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-brand-primary/30 py-4 md:grid-cols-[48px_minmax(0,1fr)_220px] md:gap-6 md:py-6"><div><span aria-hidden="true" className="font-heading text-lg text-brand-accent">0{index + 1}</span></div><div><h2 className="font-heading text-3xl text-brand-primary">{option.nombre}</h2><p className="mt-2 max-w-prose leading-6">{option.descripcion}</p></div><div className="col-start-2 md:col-start-auto"><p className="text-xl font-semibold">{new Intl.NumberFormat('es-CO').format(option.precio)} {catalog.moneda}</p><p className="mt-1 text-sm">Por persona · {option.duracionMinutos / 60} h · Precio de ejemplo</p><Link className={textLinkClass + ' mt-3 text-brand-primary'} href={bookingHref(option.id)}>Elegir este taller →</Link></div></article>)}</div>
        {!catalog.opciones.length && <p role="status" className="py-6">No hay talleres publicados en este momento.</p>}
        <section aria-labelledby="material-title" className="mt-8 grid items-start gap-6 md:grid-cols-[1.35fr_1fr] md:gap-10 md:mt-12">
          <div className="min-w-0 border-t-2 border-brand-accent pt-4">
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-brand-muted">Sobre la mesa / cuaderno de técnicas</p>
            <h2 id="material-title" className="mt-2 font-heading text-3xl tracking-[-.035em] text-brand-primary">Pared, movimiento, superficie.</h2>
            <figure className="mt-4">
              <div className="grid grid-cols-[1.1fr_1fr] items-center bg-brand-accent/[.07] p-2"><CraftStudy name="Primera taza" className="!w-full" /><CraftStudy name="Torno inicial" className="!w-full" /><div className="col-span-2 grid grid-cols-2 items-center"><CraftStudy name="Esmaltes y color" className="!w-full" /><p className="pr-3 text-sm leading-5 text-brand-primary">Levantar con las manos.<br />Centrar en el torno.<br />Ensayar capas de color.</p></div></div>
              <figcaption className="mt-3 text-sm leading-5 text-brand-muted">Estudios originales de técnicas: ilustraciones, no fotografías ni resultados garantizados. El secado y la cocción tienen sus propios tiempos; las 2 h no equivalen a una pieza lista para llevar.</figcaption>
            </figure>
            <div className="mt-5 border-t border-brand-primary/30 pt-4 text-sm leading-6"><h3 className="font-semibold text-brand-primary">Antes de elegir el turno</h3><p>De 1 a 4 asistentes por reserva. 8 plazas por taller, fecha y turno. Martes a domingo: 10:00, 14:00 y 17:00 · America/Bogota.</p><p className="mt-2 text-brand-muted">Laureles, Medellín es una ubicación conceptual. Vuelta es ficticio; no se realizan pagos ni se envían mensajes.</p></div>
          </div>
          {catalog.opciones[0]?.recursos[0] && <div className="min-w-0 border-t border-brand-primary/30 pt-4"><p className="mb-3 text-sm font-semibold text-brand-primary">El gesto, en fotografía</p><ContextMedia resource={catalog.opciones[0].recursos[0]} variant="hero" /></div>}
        </section>
      </>}
      <p className="mt-6 text-sm text-brand-muted">La disponibilidad se consulta al elegir fecha. No se realizan pagos ni se envían mensajes.</p>
    </div>
  </BrandPage>;
}
