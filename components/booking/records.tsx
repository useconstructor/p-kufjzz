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

export function PrivateRecords({ mode, id = '', codigo = '' }: { mode: 'history' | 'detail' | 'confirmation'; id?: string; codigo?: string }) {
  const { state, controller } = useBookingController();
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [record, setRecord] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useNativeBookingDialog({ triggerRef: trigger });
  const reload = useCallback(async () => {
    const ticket = ++sequence.current;
    setLoading(true); setError(''); setRecord(null); setRows([]);
    try {
      await controller.start();
      if (mode === 'history') {
        const result = await controller.loadReservations();
        if (ticket === sequence.current) setRows(result);
      } else {
        const result = codigo ? await loadOwnedCode(controller, codigo) : await controller.loadRecord(id);
        if (ticket === sequence.current) setRecord(result);
      }
    } catch (issue) {
      if (ticket === sequence.current) setError(issue instanceof Error ? issue.message : 'No pudimos consultar tus reservas.');
    } finally { if (ticket === sequence.current) setLoading(false); }
  }, [controller, mode, id, codigo]);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  const cancel = async () => {
    if (!record || lock.current || state.pending) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await controller.cancel(record.id);
      if (result && result.id === record.id) setRecord(result);
      dialog.close();
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'No pudimos confirmar la cancelación.'); dialog.close(); }
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
      {error && <BrandNotice kind="error" title="No pudimos mostrar el registro" action={<Action secondary disabled={loading} onClick={() => void reload()}>Reintentar consulta</Action>}><p>{error}</p></BrandNotice>}
      {!loading && !error && mode === 'history' && (rows.length ? <ul className="space-y-5">{rows.map(row => <li key={row.id}><WorkshopEdge serviceName={row.opcionNombre} status={row.estado === 'cancelada' ? 'cancelled' : 'neutral'}><p>{formatDate(row.fecha)} · {row.hora} · Hora de Colombia</p><p className="mt-2">{row.personas} personas · <strong>{row.estado === 'activa' ? 'Activa' : 'Cancelada'}</strong></p><p className="mt-2 text-sm">Código {row.codigo} · {money(row.precio * row.personas, row.moneda)} por el grupo</p><Link href={detailHref(row)} className={textLinkClass + ' mt-2'}>Abrir detalle y gestionar reserva</Link></WorkshopEdge></li>)}</ul> : <section className="border-y border-brand-primary/30 py-8"><h2 className="font-heading text-3xl text-brand-primary">Todavía no hay reservas aquí.</h2><p className="mt-3">Esta sesión no tiene registros guardados. Puedes empezar por un taller; revisar sus turnos no crea una reserva.</p><Link className={textLinkClass + ' mt-4'} href="/talleres">Explorar talleres →</Link></section>)}
      {!loading && !error && record && <>
        {mode === 'confirmation' && <BrandNotice kind={record.estado === 'activa' ? 'success' : 'info'} title={record.estado === 'activa' ? 'Reserva guardada y consultada en el servidor' : 'Esta reserva está cancelada'}><p>Código {record.codigo}. No se ha enviado ningún mensaje.</p></BrandNotice>}
        <WorkshopEdge serviceName={record.opcionNombre} status={record.estado === 'activa' ? 'confirmed' : 'cancelled'}><p className="text-lg">{formatDate(record.fecha)} · {record.hora}</p><p className="mt-1">Hora de Colombia · {record.duracionMinutos / 60} h · {record.personas} personas</p><p className="mt-2 font-semibold">{record.estado === 'activa' ? 'Activa' : 'Cancelada'} · Código {record.codigo}</p></WorkshopEdge>
        <div className="my-5 grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[180px_1fr]">{record.recursos[0] && <ContextMedia resource={record.recursos[0]} variant="compact" />}<div><p>{record.opcionDescripcion}</p><p className="mt-2 text-sm text-brand-muted">Fotografía representativa del proceso; no muestra resultados ni clientes de Vuelta.</p></div></div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 border-y border-brand-primary/30 py-5 [&_dt]:text-brand-muted [&_dd]:whitespace-pre-wrap [&_dd]:break-words">
          <dt>Taller</dt><dd>{record.opcionNombre}</dd><dt>Por persona</dt><dd>{money(record.precio, record.moneda)}</dd><dt>Total del grupo</dt><dd>{money(record.precio * record.personas, record.moneda)} · Precio de ejemplo, sin cobro</dd>
          <dt>Nombre</dt><dd>{record.nombre}</dd><dt>Email</dt><dd>{record.email}</dd><dt>Teléfono</dt><dd>{record.telefono}</dd><dt>Notas</dt><dd>{record.notas || 'Sin notas'}</dd><dt>Guardada</dt><dd>{timestamp(record.createdAt)}</dd><dt>Actualizada</dt><dd>{timestamp(record.updatedAt)}</dd>{record.cancelledAt && <><dt>Cancelada</dt><dd>{timestamp(record.cancelledAt)}</dd></>}</dl>
        {record.estado === 'activa' ? <div className="mt-5"><Action ref={trigger} secondary disabled={busy || !!state.pending} onClick={dialog.open}>Cancelar reserva</Action><p className="mt-2 text-sm">Te pediremos confirmación. El cupo se libera solo cuando el servidor guarda la cancelación.</p></div> : <p role="status" className="mt-5 font-semibold">Cancelación guardada. Esta reserva ya no ocupa plazas.</p>}
        <PhotoCredit className="mt-6" />
      </>}
      <dialog ref={dialog.dialogRef} aria-labelledby="cancel-title" className="m-auto w-[calc(100%-40px)] max-w-lg border-2 border-brand-primary bg-brand-background p-6 text-brand-text backdrop:bg-black/60"><h2 id="cancel-title" className="font-heading text-3xl text-brand-primary">¿Cancelar tu vuelta?</h2><p className="my-4">Cancelarás la reserva {record?.codigo} de {record?.opcionNombre}, del {record ? formatDate(record.fecha) : ''} a las {record?.hora}. Se liberarán {record?.personas} plazas cuando se confirme el guardado.</p><div className="flex flex-wrap gap-3"><Action autoFocus secondary disabled={busy} onClick={() => dialog.close()}>Conservar reserva</Action><Action disabled={busy || !!state.pending || !record} onClick={() => void cancel()}>{busy ? 'Comprobando cancelación…' : 'Sí, cancelar reserva'}</Action></div></dialog>
    </div>
  </BrandPage>;
}
