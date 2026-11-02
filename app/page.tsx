import Link from 'next/link';
import { SelectionGuide } from '@/components/brand';

const workshops = [
  { id: 'primera-taza', number: '01', name: 'Primera taza', price: '90.000 COP', material: 'Barro + manos', description: 'Una forma cotidiana como punto de partida: explorar el volumen, levantar paredes y pensar un asa.' },
  { id: 'torno-inicial', number: '02', name: 'Torno inicial', price: '120.000 COP', material: 'Barro + movimiento', description: 'Acercarse al torno: conocer el centrado y descubrir cómo cambia la forma con la presión de las manos.' },
  { id: 'esmaltes-y-color', number: '03', name: 'Esmaltes y color', price: '75.000 COP', material: 'Superficie + color', description: 'Mirar la cerámica desde su superficie: explorar combinaciones, trazos y posibilidades de acabado.' },
];

function PieceStudies() {
  return (
    <svg viewBox="0 0 600 230" fill="none" className="h-auto w-full" role="img" aria-labelledby="piece-studies-title">
      <title id="piece-studies-title">Estudios dibujados de una taza, un cuenco y tres muestras de color</title>
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M37 72 Q92 52 147 72 L140 158 Q90 181 45 157 Z" fill="#C65D42" fillOpacity=".22" />
        <ellipse cx="92" cy="72" rx="55" ry="12" />
        <path d="M149 86 C200 69 198 151 143 139 M150 100 C177 91 173 132 146 125" />
        <path d="M225 100 Q291 120 358 100 Q350 171 291 174 Q234 171 225 100Z" fill="#C65D42" fillOpacity=".38" />
        <ellipse cx="292" cy="100" rx="67" ry="17" />
        <path d="M266 174 L263 183 Q292 191 322 182 L318 173" />
        <path d="M425 70 L470 62 L480 115 L435 124 Z" fill="#254DA6" />
        <path d="M486 85 L532 92 L524 144 L478 135 Z" fill="#C65D42" />
        <path d="M438 139 L483 143 L480 194 L434 190 Z" fill="#F5F0E7" />
        <path d="M26 193 Q99 204 176 191 M218 204 Q293 216 364 202" strokeOpacity=".3" />
      </g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1440px] px-5 pt-6 md:px-8 md:pt-10 xl:px-20">
      <section aria-labelledby="home-title" className="relative isolate border-b border-brand-primary/30 pb-7 md:pb-12">
        <div className="relative grid items-center gap-6 md:grid-cols-[.85fr_1.15fr] md:gap-8 lg:gap-12">
          <div className="relative z-10">
            <p className="mb-3 text-sm font-semibold tracking-[.14em] text-brand-primary uppercase">Vuelta · Taller de cerámica</p>
            <h1 id="home-title" className="max-w-[650px] font-heading text-[clamp(3.25rem,6.8vw,6.8rem)] leading-[.94] font-semibold tracking-[-.065em] text-brand-primary">Dale forma<br />a tu pausa.</h1>
            <p className="mt-5 max-w-sm text-lg leading-6 md:mt-7 md:text-xl md:leading-7">Del barro a una forma propia.<br />Dos horas para pensar con las manos.</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 md:mt-7">
              <Link href="/talleres" className="brand-button">Explorar talleres <span aria-hidden="true">↗</span></Link>
              <Link href="/reservar" className="brand-link">Reservar</Link>
            </div>
            <p className="mt-3 text-sm text-brand-muted">Experiencias demo · Laureles, Medellín</p>
          </div>
          <div className="relative min-w-0 pb-4 pt-2 md:py-10">
            <svg aria-hidden="true" viewBox="0 0 650 620" fill="none" className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-brand-primary" preserveAspectRatio="none">
              <path d="M34 597 C175 619 607 622 622 330 C639 72 453 6 299 20 C115 38 10 190 28 330 C45 470 164 539 293 516 C447 489 507 362 468 254" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
            <figure className="relative mx-3 md:mx-5">
              <div className="border border-brand-primary/30 bg-brand-text/[.04] p-2 md:p-3">
                <img src="/images/booking-context-1-v1.jpg" alt="Manos de una persona trabajando el barro en una pieza de cerámica." width={2500} height={2000} fetchPriority="high" className="block h-auto max-h-[510px] w-full object-contain" />
              </div>
              <figcaption className="mt-3 flex items-start justify-between gap-4 text-sm leading-5 text-brand-muted">
                <span>El gesto: manos dando forma al barro.<br />Fotografía representativa.</span>
                <a href="#creditos" className="inline-flex min-h-11 shrink-0 items-center text-brand-primary underline underline-offset-4">Créditos ↗</a>
              </figcaption>
            </figure>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4 text-brand-primary md:mt-8">
          <SelectionGuide selectedId={null} />
          <p className="text-base">Barro, torno y color. <span className="text-brand-muted">Una vuelta a lo tangible.</span></p>
        </div>
      </section>

      <section aria-labelledby="workshops-title" className="py-10 md:py-16">
        <div className="mb-7 flex flex-col justify-between gap-4 md:mb-10 md:flex-row md:items-end">
          <div><p className="mb-2 text-sm font-semibold tracking-[.12em] text-brand-muted uppercase">Sobre la mesa / experiencias</p><h2 id="workshops-title" className="font-heading text-4xl leading-tight tracking-[-.045em] text-brand-primary md:text-5xl">Tres maneras de empezar.</h2></div>
          <p className="max-w-xs text-base text-brand-muted">Talleres de demostración de 2 h.<br />Precios de ejemplo por persona.</p>
        </div>
        <div className="border-t-2 border-brand-primary">
          {workshops.map((workshop) => (
            <article key={workshop.number} className="grid grid-cols-[32px_1fr] gap-x-3 gap-y-3 border-b border-brand-primary/30 py-6 md:grid-cols-[40px_1fr_1fr_160px] md:gap-x-6 md:py-8">
              <span className="pt-1 font-heading text-lg text-brand-primary">{workshop.number}</span>
              <div><p className="mb-1 text-sm text-brand-muted">{workshop.material}</p><h3 className="font-heading text-[28px] leading-tight tracking-[-.03em] text-brand-primary lg:text-3xl">{workshop.name}</h3></div>
              <p className="col-start-2 max-w-md text-base leading-6 md:col-start-auto">{workshop.description}</p>
              <div className="col-start-2 md:col-start-auto md:text-right"><p className="font-heading text-xl font-semibold text-brand-primary">{workshop.price}</p><p className="text-sm text-brand-muted">Por persona · 2 h</p><Link href={`/reservar?opcion=${workshop.id}`} aria-label={`Reservar: ${workshop.name}`} className="brand-link mt-1">Ver experiencia <span aria-hidden="true">↗</span></Link></div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="process-title" className="grid gap-8 border-b border-brand-primary/30 pb-12 md:grid-cols-2 md:gap-12 md:pb-16">
        <div className="relative border-l-[3px] border-brand-accent pl-5 md:pl-8">
          <p className="mb-3 text-sm font-semibold tracking-[.12em] text-brand-muted uppercase">Del gesto a la pieza</p>
          <h2 id="process-title" className="max-w-sm font-heading text-4xl leading-[1.05] tracking-[-.04em] text-brand-primary md:text-5xl">La forma no aparece de una vez.</h2>
          <ol className="mt-7 space-y-6">
            <li><h3 className="text-xl font-semibold text-brand-primary">01 / Tocar</h3><p className="mt-1 max-w-md">Reconocer la humedad, el peso y la resistencia del barro. Antes de darle forma, conocer el material.</p></li>
            <li><h3 className="text-xl font-semibold text-brand-primary">02 / Dar una vuelta</h3><p className="mt-1 max-w-md">Probar un gesto, ajustar la presión, volver a mirar. La mano aprende mientras hace.</p></li>
            <li><h3 className="text-xl font-semibold text-brand-primary">03 / Dejar transformar</h3><p className="mt-1 max-w-md">El secado y la cocción tienen sus propios tiempos. Las 2 h del taller no equivalen a una pieza terminada y lista para llevar.</p></li>
          </ol>
        </div>
        <figure className="self-center border-y border-brand-primary/30 bg-brand-accent/[.07] px-5 py-6 md:px-8 md:py-10">
          <div className="flex items-center justify-between gap-4 text-sm text-brand-primary"><span className="font-semibold tracking-[.12em] uppercase">Cuaderno de formas</span><span aria-hidden="true">↙</span></div>
          <PieceStudies />
          <figcaption><p className="font-heading text-2xl text-brand-primary">Un asa. Un borde. Una huella.</p><p className="mt-2 text-base text-brand-muted">Taza, cuenco y muestras de color: ilustraciones de referencia, no resultados garantizados ni fotografías de piezas del taller.</p></figcaption>
        </figure>
      </section>

      <section aria-labelledby="location-title" className="grid gap-8 py-12 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-16">
        <div><p className="mb-3 text-sm font-semibold tracking-[.12em] text-brand-muted uppercase">Un lugar para hacer</p><h2 id="location-title" className="font-heading text-4xl leading-[1.05] tracking-[-.045em] text-brand-primary md:text-5xl">Nos imaginamos<br />en Laureles.</h2><p className="mt-5 max-w-md text-lg leading-7">Una mesa de cerámica en Medellín. Vuelta es un negocio ficticio: Laureles es la ubicación conceptual, no una dirección para visitar.</p></div>
        <div className="border-t-2 border-brand-primary pt-5"><h3 className="font-heading text-2xl text-brand-primary">Horario de la demostración</h3><dl className="mt-5 divide-y divide-brand-primary/20"><div className="flex justify-between gap-5 py-3"><dt>Días</dt><dd className="text-right font-semibold">Martes a domingo</dd></div><div className="flex justify-between gap-5 py-3"><dt>Comienzos</dt><dd className="text-right font-semibold">10:00 · 14:00 · 17:00</dd></div><div className="flex justify-between gap-5 py-3"><dt>Duración</dt><dd className="font-semibold">2 h por taller</dd></div><div className="flex justify-between gap-5 py-3"><dt>Zona horaria</dt><dd className="text-right">America/Bogota</dd></div></dl><p className="mt-4 text-sm text-brand-muted">8 plazas por taller, fecha y turno. El horario no indica disponibilidad; consulta el recorrido de reserva.</p><Link href="/reservar" className="brand-button mt-6">Elegir taller y turno <span aria-hidden="true">↗</span></Link></div>
      </section>

      <aside id="creditos" aria-labelledby="credits-title" className="scroll-mt-6 border-t border-brand-primary/25 pt-5 text-sm leading-6 text-brand-muted"><h2 id="credits-title" className="font-semibold text-brand-primary">Créditos fotográficos</h2><p className="mt-1 max-w-3xl">Fotografía representativa de manos trabajando cerámica en Egipto; no muestra el taller ficticio Vuelta. «Hands of the pottery maker in Egypt 2024», de Violinistman. <a className="underline underline-offset-4" href="https://commons.wikimedia.org/wiki/File:Hands_of_the_pottery_maker_in_Egypt_2024.jpg">Original en Wikimedia Commons</a> · <a className="underline underline-offset-4" href="https://creativecommons.org/licenses/by/4.0/">Licencia CC BY 4.0</a>. Se presenta sin recorte.</p></aside>
    </main>
  );
}
