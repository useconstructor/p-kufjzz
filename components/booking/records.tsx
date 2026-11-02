'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandPage, BrandNotice, WorkshopEdge } from '@/components/brand';
import { useBookingController } from '@/lib/client/booking/use-booking-controller';
import { useNativeBookingDialog } from '@/lib/client/booking/presentation';
import { detailHref, formatDate, loadOwnedCode } from '@/lib/client/booking/business';
import type { Reservation } from '@/lib/client/booking/types';
import { Action, ContextMedia, PhotoCredit, textLinkClass } from './primitives';
import { DraftConflictPanel, RecoveryPanel, SessionProblem } from './feedback';

const money = (amount: number, currency: string) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount) + ' ' + currency;
const timestamp = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value));
type AuthorizedSnapshot = { identity: string; rows: Reservation[]; record: Reservation | null };
type ReadState = { identity: string; status: 'loading' | 'verified' | 'error'; error: string };

export function PrivateRecords({ mode, id = '', codigo = '' }: { mode: 'history' | 'detail' | 'confirmation'; id?: string; codigo?: string }) {
  const { state, controller } = useBookingController();
  const router = useRouter();
  const identity = JSON.stringify([mode, id, codigo]);
  const activeIdentity = useRef(identity); activeIdentity.current = identity;
  const [snapshot, setSnapshot] = useState<AuthorizedSnapshot | null>(null);
  const [read, setRead] = useState<ReadState>({ identity, status: 'loading', error: '' });
  const visibleSnapshot = snapshot?.identity === identity ? snapshot : null;
  const rows = visibleSnapshot?.rows ?? [];
  const record = visibleSnapshot?.record ?? null;
  const loading = read.identity !== identity || read.status === 'loading';
  const error = read.identity === identity ? read.error : '';
  const verified = read.identity === identity && read.status === 'verified';
  const authorizedRead = useRef<{ identity: string; id: string } | null>(null);
  const openedRecord = useRef<{ identity: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useNativeBookingDialog({ triggerRef: trigger });
  const reload = useCallback(async () => {
    const ticket = ++sequence.current;
    const current = () => ticket === sequence.current && activeIdentity.current === identity;
    authorizedRead.current = null;
    setSnapshot(previous => previous?.identity === identity ? previous : null);
    setRead({ identity, status: 'loading', error: '' });
    try {
      await controller.start();
      if (!current()) return;
      if (mode === 'history') {
        const result = await controller.loadReservations();
        if (current()) { setSnapshot({ identity, rows: result, record: null }); setRead({ identity, status: 'verified', error: '' }); }
      } else {
        const result = codigo ? await loadOwnedCode(controller, codigo) : await controller.loadRecord(id);
        if (current()) {
          setSnapshot({ identity, rows: [], record: result });
          authorizedRead.current = { identity, id: result.id };
          setRead({ identity, status: 'verified', error: '' });
        }
      }
    } catch (issue) {
      if (current()) setRead({ identity, status: 'error', error: issue instanceof Error ? issue.message : 'No pudimos consultar tus reservas.' });
    }
  }, [controller, mode, id, codigo, identity]);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  useEffect(() => { openedRecord.current = null; dialog.close(); }, [identity, dialog.close]);
  const canCancel = !!record && record.estado === 'activa' && verified && !busy && !state.pending;
  const openCancellation = () => {
    const authorization = authorizedRead.current;
    if (!canCancel || !record || activeIdentity.current !== identity || authorization?.identity !== identity || authorization.id !== record.id) return;
    openedRecord.current = { identity, id: record.id };
    dialog.open();
  };
  const cancel = async () => {
    const authorization = authorizedRead.current;
    if (!canCancel || !record || lock.current || activeIdentity.current !== identity || authorization?.identity !== identity || authorization.id !== record.id || openedRecord.current?.identity !== identity || openedRecord.current.id !== record.id) return;
    const ticket = ++sequence.current;
    const current = () => ticket === sequence.current && activeIdentity.current === identity;
    authorizedRead.current = null;
    lock.current = true; setBusy(true); setRead({ identity, status: 'loading', error: '' });
    try {
      const result = await controller.cancel(record.id);
      if (current()) {
        if (result && result.id === record.id) {
          setSnapshot({ identity, rows: [], record: result });
          authorizedRead.current = { identity, id: result.id };
          setRead({ identity, status: 'verified', error: '' });
        } else setRead({ identity, status: 'error', error: 'No pudimos confirmar la cancelación. Comprueba el resultado antes de volver a actuar.' });
        dialog.close();
      }
    } catch (issue) { if (current()) { setRead({ identity, status: 'error', error: issue instanceof Error ? issue.message : 'No pudimos confirmar la cancelación.' }); dialog.close(); } }
    finally { lock.current = false; setBusy(false); }
  };
  return <BrandPage title={mode === 'history' ? 'Tus próximas vueltas.' : mode === 'confirmation' ? 'El resultado de tu reserva' : 'Tu reserva, en detalle'} subtitle="Consulta privada de esta sesión. Vuelta es una demostración: sin pagos ni mensajes.">
    <div className="max-w-4xl pb-8">
      <SessionProblem state={state} controller={controller} />
      <DraftConflictPanel state={state} controller={controller} />
      <RecoveryPanel state={state} controller={controller} onRecovered={result => { if (mode === 'history' || result.id === record?.id || result.id === id || result.codigo === codigo) void reload(); else router.push(detailHref(result)); }} onNewIntent={() => void reload()} />
      {state.problem && !state.pending && state.phase !== 'session-blocked' && <BrandNotice kind="error" title="La consulta necesita tu atención"><p>{state.problem.message}</p></BrandNotice>}
      <div className="mb-5 flex flex-wrap items-center gap-5"><Action secondary disabled={loading || busy} onClick={() => void reload()}>{loading ? 'Consultando…' : mode === 'history' ? 'Recargar mis reservas' : 'Actualizar reserva'}</Action><Link href="/talleres" className={textLinkClass}>Elegir un taller</Link>{mode !== 'history' && <Link href="/mis-reservas" className={textLinkClass}>Mis reservas</Link>}</div>
      {loading && <p role="status" className="py-5">Consultando los registros guardados de tu sesión…</p>}
      {error && <BrandNotice kind="error" title={visibleSnapshot ? "No pudimos actualizar el registro" : "No pudimos mostrar el registro"} action={<Action secondary disabled={loading} onClick={() => void reload()}>Reintentar consulta</Action>}><p>{error}</p></BrandNotice>}
      {visibleSnapshot && !verified && <BrandNotice kind="info" title="Última lectura verificada"><p>{error ? 'Mostramos los datos consultados anteriormente; no pudimos actualizarlos.' : 'Conservamos los datos consultados anteriormente mientras comprobamos la actualización.'} Su estado actual debe volver a verificarse.{record?.estado === 'activa' ? ' La cancelación estará disponible cuando termine una consulta correcta.' : ''}</p></BrandNotice>}
      {visibleSnapshot && mode === 'history' && (rows.length ? <ul className="space-y-5">{rows.map(row => <li key={row.id}><WorkshopEdge serviceName={row.opcionNombre} status={row.estado === 'cancelada' ? 'cancelled' : 'neutral'}><p>{formatDate(row.fecha)} · {row.hora} · Hora de Colombia</p><p className="mt-2">{row.personas} personas · <strong>{row.estado === 'activa' ? 'Activa' : 'Cancelada'}</strong></p><p className="mt-2 text-sm">Código {row.codigo} · {money(row.precio * row.personas, row.moneda)} por el grupo</p><Link href={detailHref(row)} className={textLinkClass + ' mt-2'}>Abrir detalle y gestionar reserva</Link></WorkshopEdge></li>)}</ul> : <section className="border-y border-brand-primary/30 py-8"><h2 className="font-heading text-3xl text-brand-primary">Todavía no hay reservas aquí.</h2><p className="mt-3">{verified ? 'Esta sesión no tiene registros guardados.' : 'La última consulta verificada no tenía registros guardados.'} Puedes empezar por un taller; revisar sus turnos no crea una reserva.</p><Link className={textLinkClass + ' mt-4'} href="/talleres">Explorar talleres →</Link></section>)}
      {record && <div data-booking-record-id={record.id} data-booking-read-state={verified ? 'verified' : loading ? 'refreshing' : 'stale'}>
        {mode === 'confirmation' && verified && <BrandNotice kind={record.estado === 'activa' ? 'success' : 'info'} title={record.estado === 'activa' ? 'Reserva guardada y consultada en el servidor' : 'Esta reserva está cancelada'}><p>Código {record.codigo}. No se ha enviado ningún mensaje.</p></BrandNotice>}
        <WorkshopEdge serviceName={record.opcionNombre} status={record.estado === 'activa' ? 'confirmed' : 'cancelled'}><p className="text-lg">{formatDate(record.fecha)} · {record.hora}</p><p className="mt-1">Hora de Colombia · {record.duracionMinutos / 60} h · {record.personas} personas</p><p className="mt-2 font-semibold">{record.estado === 'activa' ? 'Activa' : 'Cancelada'} · Código {record.codigo}</p></WorkshopEdge>
        <div className="my-5 grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[180px_1fr]">{record.recursos[0] && <ContextMedia resource={record.recursos[0]} variant="compact" />}<div><p>{record.opcionDescripcion}</p><p className="mt-2 text-sm text-brand-muted">Fotografía representativa del proceso; no muestra resultados ni clientes de Vuelta.</p></div></div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 border-y border-brand-primary/30 py-5 [&_dt]:text-brand-muted [&_dd]:whitespace-pre-wrap [&_dd]:break-words">
          <dt>Taller</dt><dd>{record.opcionNombre}</dd><dt>Por persona</dt><dd>{money(record.precio, record.moneda)}</dd><dt>Total del grupo</dt><dd>{money(record.precio * record.personas, record.moneda)} · Precio de ejemplo, sin cobro</dd>
          <dt>Nombre</dt><dd>{record.nombre}</dd><dt>Email</dt><dd>{record.email}</dd><dt>Teléfono</dt><dd>{record.telefono}</dd><dt>Notas</dt><dd>{record.notas || 'Sin notas'}</dd><dt>Guardada</dt><dd>{timestamp(record.createdAt)}</dd><dt>Actualizada</dt><dd>{timestamp(record.updatedAt)}</dd>{record.cancelledAt && <><dt>Cancelada</dt><dd>{timestamp(record.cancelledAt)}</dd></>}</dl>
        {record.estado === 'activa' ? <div className="mt-5"><Action ref={trigger} secondary disabled={!canCancel} onClick={openCancellation}>Cancelar reserva</Action><p className="mt-2 text-sm">Te pediremos confirmación. El cupo se libera solo cuando el servidor guarda la cancelación.</p></div> : <p role="status" className="mt-5 font-semibold">{verified ? 'Cancelación guardada. Esta reserva ya no ocupa plazas.' : 'En la última lectura verificada, esta reserva figuraba cancelada.'}</p>}
        <PhotoCredit className="mt-6" />
      </div>}
      <dialog ref={dialog.dialogRef} aria-labelledby="cancel-title" className="m-auto w-[calc(100%-40px)] max-w-lg border-2 border-brand-primary bg-brand-background p-6 text-brand-text backdrop:bg-black/60"><h2 id="cancel-title" className="font-heading text-3xl text-brand-primary">¿Cancelar tu vuelta?</h2><p className="my-4">Cancelarás la reserva {record?.codigo} de {record?.opcionNombre}, del {record ? formatDate(record.fecha) : ''} a las {record?.hora}. Se liberarán {record?.personas} plazas cuando se confirme el guardado.</p><div className="flex flex-wrap gap-3"><Action autoFocus secondary disabled={busy} onClick={() => dialog.close()}>Conservar reserva</Action><Action disabled={!canCancel} onClick={() => void cancel()}>{busy ? 'Comprobando cancelación…' : 'Sí, cancelar reserva'}</Action></div></dialog>
    </div>
  </BrandPage>;
}
