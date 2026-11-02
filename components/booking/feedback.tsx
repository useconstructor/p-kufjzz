'use client';

import Link from 'next/link';
import { BrandNotice } from '@/components/brand';
import type { BookingController } from '@/lib/client/booking/controller';
import type { BookingState, Field, FieldErrors, RawDraft, Reservation } from '@/lib/client/booking/types';
import { formatDate } from '@/lib/client/booking/business';
import { Action, SectionHeading, textLinkClass } from './primitives';

export const fieldLabels: Partial<Record<Field, string>> = { opcion: 'Taller', fecha: 'Fecha', hora: 'Turno', personas: 'Personas', nombre: 'Nombre', email: 'Email', telefono: 'Teléfono', notas: 'Notas' };

export function DraftDetails({ draft }: { draft: Omit<RawDraft, 'paso' | 'catalogoVersion' | 'presentacionVersion' | 'personas'> & { personas: string | number } }) {
  return <dl className="grid grid-cols-[minmax(70px,auto)_1fr] gap-x-4 gap-y-2 text-base [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:whitespace-pre-wrap [&_dt]:text-[var(--brand-muted)]">
    <dt>Taller</dt><dd>{draft.opcion || 'Sin elegir'}</dd><dt>Fecha</dt><dd>{formatDate(draft.fecha)}</dd><dt>Turno</dt><dd>{draft.hora || 'Sin elegir'}</dd><dt>Personas</dt><dd>{draft.personas}</dd><dt>Nombre</dt><dd>{draft.nombre || 'Sin completar'}</dd><dt>Email</dt><dd>{draft.email || 'Sin completar'}</dd><dt>Teléfono</dt><dd>{draft.telefono || 'Sin completar'}</dd><dt>Notas</dt><dd>{draft.notas || 'Sin notas'}</dd>
  </dl>;
}

export function ErrorSummary({ errors, focus }: { errors: FieldErrors; focus: (field: Field) => void }) {
  const entries = Object.entries(errors).filter((entry): entry is [Field, string] => typeof entry[1] === 'string' && entry[1].length > 0);
  if (!entries.length) return null;
  return <div data-booking-errors role="alert" className="my-4 border-l-4 border-[var(--brand-primary)] bg-[var(--brand-background)] p-4"><h2 className="font-semibold">Revisa estos datos</h2><ul>{entries.map(([field, message]) => <li key={field}><button type="button" className="min-h-11 text-left underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]" onClick={() => focus(field)}>{fieldLabels[field] || 'Selección'}: {message}</button></li>)}</ul></div>;
}

export function SessionProblem({ state, controller }: { state: BookingState; controller: BookingController }) {
  if (state.phase !== 'session-blocked') return null;
  return <BrandNotice kind="error" title="No pudimos abrir tu sesión privada" action={<Action secondary onClick={() => void controller.retrySession().catch(() => {})}>Reintentar sesión</Action>}><p>{state.problem?.message}</p><a href="/reservar" target="_blank" rel="noopener noreferrer" className={textLinkClass}>Abrir el sitio directamente</a></BrandNotice>;
}

export function RecoveryPanel({ state, controller, onRecovered, onNewIntent }: { state: BookingState; controller: BookingController; onRecovered: (record: Reservation) => void; onNewIntent?: () => void }) {
  const pending = state.pending;
  const busy = state.phase === 'saving';
  return <>
    {pending && <section data-booking-pending role="status" className="my-5 border-2 border-[var(--brand-primary)] bg-[var(--brand-background)] p-4 sm:p-6">
      <SectionHeading>{busy ? 'Comprobando el resultado…' : state.phase === 'rejected' ? 'El envío necesita tu atención' : 'Resultado pendiente de confirmar'}</SectionHeading>
      <p className="mt-2 max-w-prose">{pending.tipo === 'cancelar' ? 'No podemos confirmar todavía la cancelación. Recupera el envío original para conocer el estado guardado.' : 'La respuesta no está confirmada. Tu reserva podría haberse guardado. Recupera el envío original antes de hacer otra reserva.'}</p>
      {state.problem && <p className="mt-2 font-semibold">{state.problem.message}</p>}
      {pending.tipo === 'crear' && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Datos del envío original</summary><DraftDetails draft={pending.payload} /></details>}
      <div className="mt-4 flex flex-wrap gap-3"><Action disabled={busy} data-booking-action="recover" onClick={async () => { const record = await controller.recoverPending(); if (record) onRecovered(record); }}>Recuperar envío original</Action><Action secondary disabled={busy} data-booking-action="new-intent" onClick={async () => { if (await controller.startNewIntent()) onNewIntent?.(); }}>Iniciar otro intento</Action></div>
      <p className="mt-3 text-sm">Iniciar otro intento conserva el envío anterior para consultarlo después; no lo cancela ni comprueba su resultado.</p>
      {pending.tipo === 'crear' && <Link href="/reservar?paso=contacto" className={textLinkClass}>Editar mis datos</Link>}
    </section>}
    {!pending && state.recoveries.length > 0 && <details className="my-5 border-y border-[var(--brand-muted)] py-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Consultar envíos anteriores</summary><ul className="divide-y divide-[var(--brand-muted)]">{state.recoveries.map((entry, index) => <li key={entry.clave} className="py-4"><p className="mb-2">{entry.tipo === 'crear' ? `Reserva del ${formatDate(entry.payload.fecha)} · ${entry.payload.hora} · ${entry.payload.personas} personas` : 'Solicitud de cancelación'} <span className="text-sm">· Envío {index + 1}</span></p>{entry.tipo === 'crear' && <details className="mb-2"><summary className="cursor-pointer py-2">Ver datos enviados</summary><DraftDetails draft={entry.payload} /></details>}<Action secondary disabled={busy} onClick={async () => { if (await controller.activateRecovery(entry.clave)) { const record = await controller.recoverPending(); if (record) onRecovered(record); } }}>Consultar este envío</Action></li>)}</ul></details>}
  </>;
}

export function DraftConflictPanel({ state, controller, onResolved }: { state: BookingState; controller: BookingController; onResolved?: () => void }) {
  const conflict = state.draftConflict;
  if (!conflict) return null;
  return <section role="alert" data-booking-conflict className="my-5 border-2 border-[var(--brand-primary)] p-4 sm:p-6"><SectionHeading>Hay cambios en otra pestaña</SectionHeading><p className="my-3">Compara tus datos con los guardados. Elige cuáles conservar antes de continuar.</p><div className="grid gap-6 md:grid-cols-2"><div><h3 className="mb-3 text-lg font-semibold">Tus cambios en esta página</h3><DraftDetails draft={conflict.localDraft} /></div><div><h3 className="mb-3 text-lg font-semibold">Borrador guardado en tu sesión</h3>{conflict.server.draft ? <DraftDetails draft={conflict.server.draft} /> : <p>No hay datos en el borrador guardado.</p>}</div></div>{conflict.server.lastValid && <details className="mt-4"><summary className="cursor-pointer py-2 font-semibold">Última revisión válida conservada</summary><p className="mb-3 text-sm">Esta revisión anterior no confirma tus cambios actuales ni una reserva.</p><DraftDetails draft={conflict.server.lastValid.payload} /></details>}<div className="mt-5 flex flex-wrap gap-3"><Action onClick={async () => { if (await controller.resolveDraftConflict('use-server')) onResolved?.(); }}>Usar el borrador guardado</Action><Action secondary onClick={async () => { if (await controller.resolveDraftConflict('overwrite-local')) onResolved?.(); }}>Conservar mis cambios</Action></div></section>;
}
