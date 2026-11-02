'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { BrandPage, BrandSteps, BrandNotice, WorkshopEdge } from '@/components/brand';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBookingController } from '@/lib/client/booking/use-booking-controller';
import { selectedReference, validateDraft } from '@/lib/client/booking/controller';
import { useMountedBookingFocus } from '@/lib/client/booking/presentation';
import { confirmationHref, formatDate, localToday, nextScheduledDate } from '@/lib/client/booking/business';
import type { Field, FieldErrors, RawDraft, Resource } from '@/lib/client/booking/types';
import { Action, ContextMedia, PhotoCredit, SectionHeading, fieldClass, textLinkClass } from './primitives';
import { DraftConflictPanel, DraftDetails, ErrorSummary, RecoveryPanel, SessionProblem, fieldLabels } from './feedback';

type Step = 'opcion-turno' | 'contacto';
const selectionFields: Field[] = ['opcion', 'personas', 'fecha', 'hora'];
const sameResource = (a: Resource, b: Resource) => a.id === b.id && a.version === b.version && a.url === b.url && a.sha256 === b.sha256 && a.width === b.width && a.height === b.height;

export function BookingFlow({ reviewPage = false }: { reviewPage?: boolean }) {
  const { state, controller } = useBookingController();
  const router = useRouter();
  const focus = useMountedBookingFocus();
  const [step, setStep] = useState<Step>('opcion-turno');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [mediaEpoch, setMediaEpoch] = useState(0);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const initialized = useRef(false);
  const { catalog, draft } = state;
  const option = catalog?.opciones.find(o => o.id === draft.opcion);
  const historical = state.pending?.tipo === 'crear' && state.lastValid?.payload.opcion === state.pending.payload.opcion && state.lastValid.payload.catalogoVersion === state.pending.payload.catalogoVersion && state.lastValid.payload.presentacionVersion === state.pending.payload.presentacionVersion ? state.lastValid.opcion : null;
  const resource = (state.pending?.tipo === 'crear' ? historical : option)?.recursos[0];
  const currentResource = useRef(resource); currentResource.current = resource;
  const mediaReady = useCallback((loaded: Resource, ready: boolean) => {
    if (currentResource.current && sameResource(loaded, currentResource.current)) controller.setMediaReady(ready);
  }, [controller]);
  const version = catalog?.version;
  const presentationVersion = catalog?.presentacionVersion;
  const zone = catalog?.zonaHoraria;

  useEffect(() => {
    if (!version || initialized.current) return;
    initialized.current = true;
    const current = controller.getSnapshot();
    const reference = selectedReference(window.location.href, current.catalog!);
    const requested = new URL(window.location.href).searchParams.get('paso');
    setStep(requested === 'contacto' || (requested !== 'opcion-turno' && current.draft.paso === 'contacto') ? 'contacto' : 'opcion-turno');
    if (reviewPage || current.pending) return;
    const patch: Partial<RawDraft> = {};
    if (!current.draft.opcion && !reference.present && current.catalog!.opciones.length === 1) patch.opcion = current.catalog!.opciones[0].id;
    if (!current.draft.fecha) patch.fecha = nextScheduledDate(current.catalog!);
    if (Object.keys(patch).length) void controller.editDraft({ ...patch, catalogoVersion: current.catalog!.version, presentacionVersion: current.catalog!.presentacionVersion }).catch(() => {});
  }, [controller, version, reviewPage]);

  useEffect(() => {
    if (version && draft.opcion && /^\d{4}-\d{2}-\d{2}$/.test(draft.fecha)) void controller.loadAvailability();
    // Only input primitives and explicit retry drive requests; published result/error/loading never do.
  }, [controller, version, draft.opcion, draft.fecha, draft.personas, availabilityRetry]);

  const revealField = useCallback((field: Field) => {
    if (reviewPage) { router.push('/reservar?' + new URLSearchParams({ paso: selectionFields.includes(field) ? 'opcion-turno' : 'contacto', campo: field })); return; }
    setStep(selectionFields.includes(field) ? 'opcion-turno' : 'contacto');
    focus.requestFocus(field);
  }, [reviewPage, router, focus.requestFocus]);
  useEffect(() => {
    if (!version || reviewPage) return;
    const field = new URL(window.location.href).searchParams.get('campo') as Field | null;
    if (field && fieldLabels[field]) revealField(field);
  }, [version, reviewPage, revealField]);

  const edit = (field: Field, value: string) => {
    setErrors(previous => ({ ...previous, [field]: undefined }));
    void controller.editDraft({ [field]: value }).catch(() => {});
  };
  const liveErrors = { ...errors, ...state.errors };
  const fieldError = (field: Field) => liveErrors[field] ? <p id={`${field}-error`} className="mt-1 text-sm font-semibold text-[var(--brand-primary)]">{liveErrors[field]}</p> : null;
  const accessibility = (field: Field) => ({ 'aria-invalid': !!liveErrors[field], 'aria-describedby': liveErrors[field] ? `${field}-error` : undefined });
  const availability = state.availability?.opcion === draft.opcion && state.availability.fecha === draft.fecha ? state.availability : null;
  const next = availability?.turnos.find(slot => slot.disponibles >= Number(draft.personas));
  const selectedSlot = availability?.turnos.find(slot => slot.hora === draft.hora);
  const unavailable = !!draft.hora && !!availability && (!selectedSlot || selectedSlot.disponibles < Number(draft.personas));
  const ready = state.mediaReady && !!availability && !state.availabilityLoading;

  const validate = (selectionOnly: boolean) => {
    const snapshot = controller.getSnapshot();
    const checked = validateDraft(snapshot.draft, snapshot.catalog, Date.now(), snapshot.referenceError, snapshot.mediaReady);
    if (!checked.hora && (!snapshot.availability || snapshot.availability.opcion !== snapshot.draft.opcion || snapshot.availability.fecha !== snapshot.draft.fecha || !snapshot.availability.turnos.some(slot => slot.hora === snapshot.draft.hora && slot.disponibles >= Number(snapshot.draft.personas)))) checked.hora = 'Elige un turno con lugares suficientes.';
    const relevant = selectionOnly ? Object.fromEntries(Object.entries(checked).filter(([key]) => selectionFields.includes(key as Field))) as FieldErrors : checked;
    setErrors(relevant);
    const first = (Object.keys(relevant) as Field[]).find(key => relevant[key]);
    if (first) revealField(first);
    return !first;
  };
  const proceed = async () => {
    if (!validate(step === 'opcion-turno')) return;
    setBusy(true);
    try {
      await controller.editDraft({ paso: 'contacto' });
      if (controller.getSnapshot().draftConflict) return;
      if (step === 'opcion-turno') { setStep('contacto'); focus.requestFocus('nombre'); }
      else router.push('/revision');
    } catch { /* Actual controller error remains rendered. */ }
    finally { setBusy(false); }
  };
  const performReview = async () => {
    setBusy(true); setErrors({});
    try { await controller.reviewServer(); }
    finally { setBusy(false); }
  };
  const reviewed = reviewPage && state.phase === 'review' && !!state.lastValid;
  const summaryOption = reviewed ? state.lastValid!.opcion : option;
  const summaryDraft = reviewed ? state.lastValid!.payload : draft;
  const summaryParty = String(summaryDraft.personas);
  const validSummaryParty = /^[1-4]$/.test(summaryParty);
  const priceSummary = summaryOption ? <p className="mt-3 text-base"><strong>{new Intl.NumberFormat('es-CO').format(summaryOption.precio)} COP por persona</strong>{validSummaryParty ? <> · <strong>{new Intl.NumberFormat('es-CO').format(summaryOption.precio * Number(summaryParty))} COP por el grupo</strong></> : <> · Elige de 1 a 4 personas para calcular el grupo.</>}<span className="mt-1 block text-sm text-brand-muted">Precio de demostración · Sin cobro.</span></p> : null;
  const resolved = () => { setAvailabilityRetry(n => n + 1); setMediaEpoch(n => n + 1); setErrors({}); };
  const loading = !catalog && ['idle', 'loading'].includes(state.phase);

  return <BrandPage title={reviewPage ? 'Revisa tu reserva' : 'Reserva tu vuelta'} subtitle={reviewPage ? 'Un último vistazo antes de guardar.' : undefined} className="[&>header]:mb-3 [&_h1]:text-[32px] sm:[&_h1]:text-5xl">
    <div data-booking-flow data-booking-phase={state.phase} className="mx-auto max-w-5xl pb-8 text-[var(--brand-text)]">
      <BrandSteps current={reviewPage ? 'revision' : step} className="mb-3 text-sm font-semibold leading-5" />
      <SessionProblem state={state} controller={controller} />
      {loading && <p role="status" className="py-6">Preparando tu taller y los turnos disponibles…</p>}
      {!catalog && state.phase === 'error' && <BrandNotice kind="error" title="No pudimos cargar las reservas" action={<Action onClick={() => void controller.start().catch(() => {})}>Reintentar</Action>}><p>{state.problem?.message}</p></BrandNotice>}
      {catalog && <>
        <div className="grid grid-cols-[112px_1fr] items-start gap-3 border-t-2 border-[var(--brand-text)] pt-3 sm:grid-cols-[180px_1fr] sm:gap-6">
          {resource ? <ContextMedia key={`${mediaEpoch}:${state.pending?.tipo === 'crear' ? state.pending.payload.opcion : draft.opcion}`} resource={resource} variant="compact" onReady={mediaReady} /> : <div className="flex min-h-[104px] items-center bg-[var(--brand-surface)] p-3 text-sm">{state.referenceError ? 'Elige un taller válido.' : 'Elige un taller para ver el proceso.'}</div>}
          <div className="min-w-0 pt-1"><p className="font-[family-name:var(--brand-font-heading)] text-xl sm:text-2xl">{reviewPage ? 'Tu pausa, a un paso.' : 'Manos al barro.'}</p><p className="mt-1 text-sm leading-5">{reviewPage ? 'Revisar no aparta lugares. El guardado comprueba de nuevo el cupo.' : 'De 1 a 4 personas · 2 h. Mar–dom: 10:00, 14:00 y 17:00. Hora de Colombia.'}</p><p className="mt-2 text-xs text-[var(--brand-muted)]">Vuelta ficticio · Foto representativa del proceso.</p></div>
        </div>

        {state.referenceError && <BrandNotice kind="error" title="Revisa el taller del enlace"><p>{state.referenceError}</p></BrandNotice>}
        {state.problem && !state.pending && state.phase !== 'session-blocked' && !state.draftConflict && (availability || !draft.fecha || !draft.opcion) && <BrandNotice kind="error" title="No pudimos completar este paso"><p>{state.problem.message}</p></BrandNotice>}
        <DraftConflictPanel state={state} controller={controller} onResolved={resolved} />
        <RecoveryPanel state={state} controller={controller} onRecovered={record => router.push(confirmationHref(record))} onNewIntent={() => { setMediaEpoch(n => n + 1); if (reviewPage) router.push('/reservar?paso=contacto'); }} />
        <ErrorSummary errors={liveErrors} focus={revealField} />

        {reviewPage ? <section className="mt-4">
          <WorkshopEdge serviceName={reviewed ? state.lastValid!.opcion.nombre : option?.nombre} status={unavailable ? 'warning' : 'neutral'}><div data-booking-selection className="flex flex-wrap items-center gap-x-6 gap-y-2"><span><CalendarDays className="mr-2 inline" size={18} aria-hidden="true" />{formatDate(draft.fecha)} · {draft.hora || 'Turno por elegir'}</span><span><Users className="mr-2 inline" size={18} aria-hidden="true" />{draft.personas} personas</span>{unavailable && <strong>No disponible</strong>}</div></WorkshopEdge>
          <div className="border-b border-[var(--brand-text)] py-6"><SectionHeading>{reviewed ? 'Todo listo para guardar' : 'Comprueba tus datos'}</SectionHeading><p className="mb-5 mt-2 text-sm">Hora de Colombia. Precios de ejemplo por persona; sin pagos ni envío de mensajes.</p><dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:whitespace-pre-wrap [&_dt]:text-[var(--brand-muted)]">{(['nombre', 'email', 'telefono', 'notas'] as const).map(field => <div key={field} className="contents"><dt>{fieldLabels[field]}</dt><dd>{(reviewed ? state.lastValid!.payload[field] : draft[field]) || 'Sin notas'}</dd></div>)}</dl></div>
          {state.lastValid && !reviewed && !state.pending && <p className="mt-3 text-sm">Conservamos tu revisión anterior. Comprueba los datos actuales para poder guardar.</p>}
          {state.availabilityLoading && <p role="status" className="my-3">Comprobando los lugares de tu turno…</p>}
          {!availability && !state.availabilityLoading && <BrandNotice kind="error" title="No pudimos comprobar los turnos" action={<Action secondary onClick={() => setAvailabilityRetry(n => n + 1)}>Reintentar disponibilidad</Action>}><p>{state.problem?.message || 'Comprueba la fecha y vuelve a intentarlo.'}</p></BrandNotice>}
          {unavailable && <BrandNotice kind="warning" title="Este turno ya no tiene lugares suficientes"><p>Conservamos tu selección y tus datos. Elige otro turno y vuelve a revisar.</p><Link className={textLinkClass} href="/reservar?paso=opcion-turno">Cambiar turno</Link></BrandNotice>}
          <section aria-label="Resumen antes de guardar" className="mt-6 border-t-2 border-brand-primary py-4"><p className="text-sm font-semibold text-brand-primary">Tu mesa de cerámica</p><h3 className="mt-1 font-heading text-2xl text-brand-primary">{summaryOption?.nombre || 'Taller por elegir'}</h3><p className="mt-2">{formatDate(summaryDraft.fecha)} · {summaryDraft.hora || 'Turno por elegir'} · Hora de Colombia</p><p>{summaryParty} personas</p>{priceSummary}</section>
          <div className="mt-2 flex flex-wrap items-center gap-4"><Link className={textLinkClass} href="/reservar?paso=contacto">Editar datos</Link><Link className={textLinkClass} href="/reservar?paso=opcion-turno">Editar taller y turno</Link>{reviewed ? <Action data-booking-action="save" disabled={busy || !!state.pending || !ready} onClick={async () => { setBusy(true); try { const record = await controller.save(); if (record) router.push(confirmationHref(record)); } finally { setBusy(false); } }}>{busy ? 'Guardando…' : 'Guardar reserva'}<ArrowRight aria-hidden="true" size={18} /></Action> : <Action data-booking-action="review" disabled={busy || !ready || !!state.pending || !!state.draftConflict} onClick={performReview}>{busy ? 'Revisando…' : 'Revisar reserva'}<ArrowRight aria-hidden="true" size={18} /></Action>}</div>
        </section> : <form noValidate onSubmit={event => { event.preventDefault(); void proceed(); }}>
          {step === 'opcion-turno' ? <section className="mt-2">
            <div className="grid grid-cols-[1fr_108px] gap-3 sm:grid-cols-2"><div><label htmlFor="opcion" className="mb-1 block font-semibold">Taller</label><select id="opcion" name="opcion" ref={focus.targetRef('opcion')} value={state.referenceError ? '' : draft.opcion} {...accessibility('opcion')} onChange={event => { setErrors({}); void controller.chooseOption(event.target.value).catch(() => {}); }} className={fieldClass}><option value="">Elige una opción</option>{draft.opcion && !catalog.opciones.some(o => o.id === draft.opcion) && <option value={draft.opcion}>Taller no disponible: {draft.opcion}</option>}{catalog.opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>{fieldError('opcion')}</div><div><label htmlFor="personas" className="mb-1 block font-semibold">Personas</label><Input id="personas" name="personas" ref={focus.targetRef('personas')} type="number" inputMode="numeric" min={catalog.politica.minPersonas} max={catalog.politica.maxPersonas} value={draft.personas} onChange={event => edit('personas', event.target.value)} {...accessibility('personas')} className={fieldClass} />{fieldError('personas')}</div></div>
            <div className="mt-3 grid grid-cols-[minmax(145px,1fr)_1fr] items-end gap-3"><div><label htmlFor="fecha" className="mb-1 block font-semibold">Fecha</label><Input id="fecha" name="fecha" ref={focus.targetRef('fecha')} type="date" min={zone ? localToday(zone) : undefined} value={draft.fecha} onChange={event => edit('fecha', event.target.value)} {...accessibility('fecha')} className={fieldClass} />{fieldError('fecha')}</div><div aria-live="polite" className="min-w-0">{state.availabilityLoading ? <p role="status" className="py-2 text-sm">Consultando turnos…</p> : next ? <button type="button" className="min-h-12 w-full border-l-4 border-[var(--brand-surface)] px-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]" onClick={() => edit('hora', next.hora)}><span className="block text-xs">Próximo turno disponible</span><strong className="text-xl">{next.hora}</strong></button> : availability ? <p className="text-sm">Sin turnos con cupo para {draft.personas} personas. Elige otra fecha.</p> : <button type="button" className={textLinkClass + ' text-sm'} onClick={() => setAvailabilityRetry(n => n + 1)}>Reintentar disponibilidad</button>}</div></div>
            {!availability && !state.availabilityLoading && draft.fecha && draft.opcion && <div role="alert" className="mt-3 border-l-4 border-[var(--brand-primary)] pl-3 text-sm"><p>No pudimos comprobar los turnos.</p><p>{state.problem?.message || 'Usa Reintentar disponibilidad para volver a consultarlos.'}</p></div>}
            <div className="mt-4"><label htmlFor="hora" className="mb-1 block font-semibold">Turno</label><select id="hora" name="hora" ref={focus.targetRef('hora')} value={draft.hora} {...accessibility('hora')} onChange={event => edit('hora', event.target.value)} className={fieldClass}><option value="">Elige un turno</option>{draft.hora && !availability?.turnos.some(slot => slot.hora === draft.hora) && <option value={draft.hora}>{draft.hora} · Sin disponibilidad comprobada</option>}{availability?.turnos.map(slot => <option key={slot.hora} value={slot.hora} disabled={slot.disponibles < Number(draft.personas)}>{slot.hora}{slot.disponibles < Number(draft.personas) ? ' · No disponible' : ` · ${slot.disponibles} lugares`}</option>)}</select>{fieldError('hora')}</div>
            {availability && <><button type="button" className={textLinkClass + ' mt-1 text-sm'} aria-expanded={showAllTimes} onClick={() => setShowAllTimes(value => !value)}>{showAllTimes ? 'Cerrar todos los turnos' : 'Ver todos los turnos'}</button>{showAllTimes && <TimeChoices slots={availability.turnos} party={Number(draft.personas)} selected={draft.hora} onSelect={time => edit('hora', time)} />}</>}
            {draft.hora && <WorkshopEdge serviceName={option?.nombre} status={unavailable ? 'warning' : 'neutral'} className="mt-3"><div data-booking-selection aria-live="polite">{formatDate(draft.fecha)} · {draft.hora} · {draft.personas} personas{unavailable && <strong className="ml-2">No disponible</strong>}</div></WorkshopEdge>}
          </section> : <section className="mt-3"><WorkshopEdge serviceName={option?.nombre} status={unavailable ? 'warning' : 'neutral'}><div data-booking-selection>{formatDate(draft.fecha)} · {draft.hora} · {draft.personas} personas{unavailable && <strong className="ml-2">No disponible</strong>}</div></WorkshopEdge><div className="my-4 flex flex-wrap items-center justify-between gap-2"><SectionHeading>Tus datos</SectionHeading><button type="button" className={textLinkClass + ' text-sm'} onClick={() => { setStep('opcion-turno'); focus.requestFocus('opcion'); }}>Cambiar taller o turno</button></div><p className="mb-5 text-sm">Solo los usaremos en esta demostración. No enviaremos mensajes.</p><div className="grid gap-4 sm:grid-cols-2">{(['nombre', 'email', 'telefono'] as const).map(field => <div key={field} className={field === 'nombre' ? 'sm:col-span-2' : ''}><label htmlFor={field} className="mb-1 block font-semibold">{fieldLabels[field]}</label><Input id={field} name={field} ref={focus.targetRef(field)} type={field === 'email' ? 'email' : field === 'telefono' ? 'tel' : 'text'} autoComplete={field === 'nombre' ? 'name' : field === 'telefono' ? 'tel' : 'email'} value={draft[field]} onChange={event => edit(field, event.target.value)} {...accessibility(field)} className={fieldClass} />{fieldError(field)}{field === 'telefono' && <p className="mt-1 text-sm text-[var(--brand-muted)]">De 7 a 15 dígitos; puedes usar +, espacios, paréntesis y guiones.</p>}</div>)}<div className="sm:col-span-2"><label htmlFor="notas" className="mb-1 block font-semibold">Notas <span className="font-normal">(opcional)</span></label><Textarea id="notas" name="notas" ref={focus.targetRef('notas')} rows={4} value={draft.notas} onChange={event => edit('notas', event.target.value)} {...accessibility('notas')} className={fieldClass + ' h-auto min-h-28 resize-y'} /><p className="mt-1 text-sm text-[var(--brand-muted)]">Hasta 2000 caracteres.</p>{fieldError('notas')}</div></div></section>}
          <div className="mt-5 flex flex-wrap items-center gap-4"><Action type="submit" data-booking-action={step === 'contacto' ? 'continue-review' : 'continue'} disabled={busy || state.phase === 'saving' || !!state.draftConflict}>{busy ? 'Un momento…' : step === 'contacto' ? 'Continuar a revisión' : 'Continuar'}<ArrowRight size={18} aria-hidden="true" /></Action>{step === 'contacto' && <button type="button" className={textLinkClass} onClick={() => { setStep('opcion-turno'); focus.requestFocus('opcion'); }}>Volver</button>}</div>
        </form>}
        {state.lastValid && !reviewPage && <details className="mt-6 border-t border-[var(--brand-muted)] pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Ver última revisión válida</summary><p className="mb-3 text-sm">Es una revisión anterior; no confirma los datos que estás editando ni una reserva guardada.</p><DraftDetails draft={state.lastValid.payload} /></details>}
        {!reviewPage && priceSummary}
        <PhotoCredit className="mt-8 max-w-xl" />
      </>}
      <Link href="/talleres" className={textLinkClass + ' mt-4 text-sm'}>Volver a los talleres</Link>
    </div>
  </BrandPage>;
}

function TimeChoices({ slots, party, selected, onSelect }: { slots: { hora: string; disponibles: number }[]; party: number; selected: string; onSelect: (time: string) => void }) {
  const grid = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const [marker, setMarker] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => { const node = nodes.current.get(selected); if (node && grid.current) setMarker({ x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight }); };
    measure(); const observer = new ResizeObserver(measure); if (grid.current) observer.observe(grid.current); return () => observer.disconnect();
  }, [selected]);
  return <div ref={grid} className="relative grid grid-cols-4 gap-2 py-2 sm:grid-cols-6" aria-label="Todos los turnos">{marker && <span data-booking-time-marker aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-[var(--brand-radius)] bg-[var(--brand-surface)] transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ width: marker.width, height: marker.height, transform: `translate(${marker.x}px, ${marker.y}px)` }} />}{slots.map(slot => <button ref={node => { if (node) nodes.current.set(slot.hora, node); else nodes.current.delete(slot.hora); }} key={slot.hora} type="button" aria-pressed={selected === slot.hora} disabled={slot.disponibles < party} onClick={() => onSelect(slot.hora)} className="relative z-10 min-h-12 rounded-[var(--brand-radius)] border border-[var(--brand-text)] px-1 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:border-[var(--brand-muted)] disabled:text-[var(--brand-muted)]"><span className="block font-semibold">{slot.hora}</span>{slot.disponibles < party && <span className="block text-xs">Sin cupo</span>}</button>)}</div>;
}
