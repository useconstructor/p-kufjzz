import { emptyDraft, type Availability, type BookingState, type Catalog, type ClientProblem, type CreatePayload, type DraftEnvelope, type Field, type FieldErrors, type Pending, type RawDraft, type Reservation, type ReviewSnapshot } from './types';

export class BookingError extends Error {
  constructor(public code: string, message: string, public status?: number, public field?: string) { super(message); this.name = 'BookingError'; }
}
export type LockProvider = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };
export type ControllerOptions = {
  fetch?: typeof fetch; locks?: LockProvider | null; namespace?: string; requestTimeoutMs?: number;
  newKey?: () => string; now?: () => number; getHref?: () => string;
  watchLocation?: (listener: () => void) => () => void;
};
const fields: Field[] = ['opcion', 'fecha', 'hora', 'personas', 'nombre', 'email', 'telefono', 'notas', 'catalogoVersion', 'presentacionVersion', 'paso'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function immutable<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) immutable(child); }
  return value;
}
function problem(error: unknown): ClientProblem {
  return error instanceof BookingError ? { code: error.code, message: error.message, status: error.status, field: error.field } : { code: 'NETWORK', message: 'No pudimos confirmar el resultado. Recupera el envío original antes de enviar otro.' };
}
function assertReservation(value: unknown): Reservation {
  if (!value || typeof value !== 'object') throw new BookingError('INVALID_RESPONSE', 'La respuesta del servidor no contiene una reserva verificable.');
  const row = value as Reservation;
  const strings = ['codigo', 'opcion', 'opcionNombre', 'opcionDescripcion', 'moneda', 'fecha', 'hora', 'zonaHoraria', 'inicioUtc', 'finUtc', 'nombre', 'email', 'telefono', 'notas', 'createdAt', 'updatedAt'] as const;
  if (!UUID.test(row.id) || !['activa', 'cancelada'].includes(row.estado) || strings.some(field => typeof row[field] !== 'string') || !Number.isFinite(row.precio) || row.precio < 0 || !Number.isInteger(row.personas) || row.personas < 1 || !Number.isInteger(row.duracionMinutos) || row.duracionMinutos <= 0 || !Number.isInteger(row.catalogoVersion) || !Number.isInteger(row.presentacionVersion) || !Array.isArray(row.recursos) || row.recursos.some(resource => !resource || typeof resource.id !== 'string' || typeof resource.url !== 'string' || typeof resource.sha256 !== 'string' || typeof resource.alt !== 'string' || !Number.isInteger(resource.version)) || (row.estado === 'cancelada' ? typeof row.cancelledAt !== 'string' : row.cancelledAt !== null)) throw new BookingError('INVALID_RESPONSE', 'La respuesta del servidor no contiene una reserva verificable.');
  return copy(row);
}
function resultReservation(value: unknown): Reservation {
  const candidate = value && typeof value === 'object' && 'reserva' in value ? (value as { reserva: unknown }).reserva : value;
  return assertReservation(candidate);
}
function assertPending(value: Pending): Pending {
  if (!UUID.test(value.clave) || !['crear', 'cancelar'].includes(value.tipo)) throw new BookingError('INVALID_PENDING', 'No podemos recuperar este envío de forma segura.');
  return immutable(copy(value));
}
function assertDraftEnvelope(value: DraftEnvelope): DraftEnvelope {
  if (!value || typeof value !== 'object' || !('pending' in value) || !('draft' in value) || !Number.isSafeInteger(value.revision) || value.revision < 0 || !('lastValid' in value)) throw new BookingError('INVALID_RESPONSE', 'No pudimos leer el borrador privado.');
  if (value.pending) assertPending(value.pending);
  if (value.lastValid && (!Number.isSafeInteger(value.lastValid.revision) || value.lastValid.revision < 0 || !value.lastValid.payload || !value.lastValid.opcion || typeof value.lastValid.reviewedAt !== 'string')) throw new BookingError('INVALID_RESPONSE', 'No pudimos leer la revisión privada.');
  return copy(value);
}
export function selectedReference(href: string, catalog: Catalog, aliases = ['opcion', 'servicio', 'taller']): { present: boolean; id: string | null; error: string | null } {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.replace(/^#\??/, ''));
  const values: string[] = [];
  for (const source of [url.searchParams, fragment]) for (const key of aliases) if (source.has(key)) values.push(...source.getAll(key));
  if (!values.length) return { present: false, id: null, error: null };
  if (values.some(id => !id) || new Set(values).size !== 1 || !catalog.opciones.some(option => option.id === values[0])) return { present: true, id: null, error: 'La opción del enlace no es válida. Elige una opción disponible para continuar.' };
  return { present: true, id: values[0], error: null };
}
/** Converts the provided local calendar date/time, then verifies the actual zone roundtrip. */
export function zonedStart(date: string, time: string, zone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number), [h, minute] = time.split(':').map(Number);
  const desired = Date.UTC(y, m - 1, d, h, minute);
  const nominal = new Date(desired);
  if (nominal.getUTCFullYear() !== y || nominal.getUTCMonth() !== m - 1 || nominal.getUTCDate() !== d || h > 23 || minute > 59) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = (timestamp: number) => Object.fromEntries(formatter.formatToParts(timestamp).map(p => [p.type, p.value]));
    let candidate = desired;
    for (let i = 0; i < 3; i++) { const p = parts(candidate); candidate += desired - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
    const p = parts(candidate);
    return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time ? candidate : null;
  } catch { return null; }
}
export function validateDraft(draft: RawDraft, catalog: Catalog | null, now: number, referenceError: string | null, mediaReady: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!catalog || referenceError || !catalog.opciones.some(option => option.id === draft.opcion)) errors.opcion = referenceError || 'Elige una opción disponible.';
  if (catalog && (draft.catalogoVersion !== catalog.version || draft.presentacionVersion !== catalog.presentacionVersion)) errors.opcion = 'Actualiza la opción antes de continuar.';
  if (draft.nombre.trim().length < 2 || draft.nombre.length > 120 || /[\u0000-\u001f\u007f]/.test(draft.nombre)) errors.nombre = 'Escribe un nombre de 2 a 120 caracteres.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) || draft.email.length > 254) errors.email = 'Escribe un email válido.';
  const digits = draft.telefono.replace(/\D/g, '');
  if (draft.telefono.length > 40 || !/^\+?[0-9 ()-]+$/.test(draft.telefono) || digits.length < 7 || digits.length > 15) errors.telefono = 'Escribe un teléfono válido.';
  if (draft.notas.length > 2000 || /[\u0000\u000b\u000c]/.test(draft.notas)) errors.notas = 'Las notas pueden tener hasta 2000 caracteres y no admiten caracteres de control.';
  if (!/^\d+$/.test(draft.personas) || !Number.isSafeInteger(Number(draft.personas)) || (catalog && (Number(draft.personas) < catalog.politica.minPersonas || Number(draft.personas) > catalog.politica.maxPersonas))) errors.personas = 'Elige una cantidad permitida.';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.fecha) ? new Date(draft.fecha + 'T00:00:00Z') : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== draft.fecha || (catalog && !catalog.politica.diasSemana.includes(date.getUTCDay()))) errors.fecha = 'Elige una fecha válida del horario.';
  if (!catalog || !catalog.politica.horas.includes(draft.hora)) errors.hora = 'Elige una hora del horario.';
  if (catalog && !errors.fecha && !errors.hora) { const start = zonedStart(draft.fecha, draft.hora, catalog.zonaHoraria); if (start === null || start <= now) errors.hora = 'Elige un turno futuro.'; }
  if (!mediaReady) errors.opcion = 'La imagen de la opción no está disponible. Reintenta su carga antes de continuar.';
  return errors;
}

export class BookingController {
  private state: BookingState;
  private initial: BookingState;
  private listeners = new Set<() => void>();
  private fetcher: typeof fetch;
  private locks: LockProvider | null;
  private namespace: string;
  private timeout: number;
  private sessionPromise: Promise<void> | null = null;
  private bootPromise: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private dispatchPromise: Promise<Reservation | null> | null = null;
  private unwatch: (() => void) | null = null;
  private reviewed: CreatePayload | null = null;
  private availabilitySequence = 0;
  private editSequence = 0;
  private reviewSequence = 0;
  constructor(private options: ControllerOptions = {}) {
    this.fetcher = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.locks = options.locks === undefined ? (typeof navigator !== 'undefined' ? navigator.locks : null) : options.locks;
    this.namespace = options.namespace || 'constructor-booking'; this.timeout = options.requestTimeoutMs ?? 20_000;
    this.state = immutable({ phase: 'idle', catalog: null, draft: emptyDraft(), pending: null, recoveries: [], record: null, reservations: [], errors: {}, firstErrorField: null, problem: null, editingRequiresChoice: false, referenceError: null, availability: null, availabilityLoading: false, mediaReady: false, revision: 0, lastValid: null, draftConflict: null });
    this.initial = this.state;
  }
  getSnapshot = (): BookingState => this.state;
  getServerSnapshot = (): BookingState => this.initial;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<BookingState>) { this.state = immutable({ ...this.state, ...copy(patch) }); for (const listener of this.listeners) listener(); }
  private now() { return this.options.now?.() ?? Date.now(); }
  private key() { const key = this.options.newKey?.() ?? globalThis.crypto?.randomUUID?.(); if (!key || !UUID.test(key)) throw new BookingError('SECURE_RANDOM_REQUIRED', 'No podemos preparar un envío seguro en este navegador.'); return key; }
  private href() { return this.options.getHref?.() ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/'); }
  private async api<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
    if (!path.startsWith('/api/')) throw new BookingError('INVALID_ENDPOINT', 'El destino de la solicitud no es válido.');
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), this.timeout);
    try {
      const response = await this.fetcher(path, { method, credentials: 'same-origin', cache: 'no-store', signal: abort.signal, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      let data: { ok?: boolean; data?: T; error?: { code?: string; message?: string; field?: string } };
      try { data = await response.json(); } catch { throw new BookingError('INVALID_RESPONSE', 'No pudimos leer la respuesta del servidor.', response.status); }
      if (!response.ok || data.ok !== true) throw new BookingError(data.error?.code || 'REQUEST_FAILED', data.error?.message || 'No pudimos completar la solicitud.', response.status, data.error?.field);
      return data.data as T;
    } catch (error) {
      if (!(error instanceof BookingError) && method === 'GET') throw new BookingError('NETWORK_READ', 'No pudimos consultar la información. Comprueba tu conexión y vuelve a intentarlo.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  ensureSession = (): Promise<void> => {
    if (this.sessionPromise) return this.sessionPromise;
    if (!this.locks) { const error = new BookingError('LOCKS_UNAVAILABLE', 'Abre la página directamente o usa un navegador compatible para iniciar una sesión privada.'); this.update({ phase: 'session-blocked', problem: problem(error) }); return Promise.reject(error); }
    this.sessionPromise = this.locks.request(this.namespace + '-session', async () => {
      await this.api('/api/sesion', 'POST', {});
      try { await this.api('/api/sesion'); } catch { throw new BookingError('COOKIE_BLOCKED', 'No pudimos confirmar la cookie privada. Abre la página directamente y reintenta.'); }
    }).catch(error => { this.sessionPromise = null; this.update({ phase: 'session-blocked', problem: problem(error) }); throw error; });
    return this.sessionPromise;
  };
  retrySession = async (): Promise<void> => {
    // A replacement anonymous owner cannot recover the old owner's operation.
    if (this.state.pending || this.state.record || this.state.reservations.length) {
      try { await this.api('/api/sesion'); }
      catch { const error = new BookingError('SESSION_LOST', 'La sesión anterior no está disponible. Conservamos el envío sin confirmarlo; iniciar otra sesión no recupera sus reservas.'); this.update({ phase: 'session-blocked', problem: problem(error) }); throw error; }
      this.sessionPromise = Promise.resolve();
    } else this.sessionPromise = null;
    this.bootPromise = null; await this.start();
  };
  private async privateApi<T>(path: string, method = 'GET', body?: unknown, key?: string) { await this.ensureSession(); return this.api<T>(path, method, body, key); }
  start = (): Promise<void> => {
    if (!this.unwatch) {
      const listen = this.options.watchLocation ?? (listener => { if (typeof window === 'undefined') return () => {}; window.addEventListener('hashchange', listener); window.addEventListener('popstate', listener); return () => { window.removeEventListener('hashchange', listener); window.removeEventListener('popstate', listener); }; });
      this.unwatch = listen(() => this.revalidateReference());
    }
    if (this.bootPromise) return this.bootPromise;
    this.update({ phase: 'loading', problem: null });
    this.bootPromise = (async () => {
      const [catalog, saved] = await Promise.all([this.api<Catalog>('/api/catalogo'), this.privateApi<DraftEnvelope>('/api/borrador')]);
      if (!Array.isArray(catalog?.opciones) || !catalog.politica || !Number.isInteger(catalog.version)) throw new BookingError('INVALID_CATALOG', 'No pudimos leer las opciones disponibles.');
      const envelope = assertDraftEnvelope(saved); const draft = envelope.draft || emptyDraft();
      if (!envelope.draft) { draft.personas = String(catalog.politica.minPersonas); draft.catalogoVersion = catalog.version; draft.presentacionVersion = catalog.presentacionVersion; }
      this.update({ catalog, draft, pending: envelope.pending, recoveries: envelope.recoveries || [], revision: envelope.revision, lastValid: envelope.lastValid, draftConflict: null, phase: envelope.pending ? 'unconfirmed' : 'editing', editingRequiresChoice: false, problem: null });
      this.revalidateReference();
    })().catch(error => { if (this.state.phase !== 'session-blocked') this.update({ phase: 'error', problem: problem(error) }); this.bootPromise = null; throw error; });
    return this.bootPromise;
  };
  detachLocationListeners = () => { this.unwatch?.(); this.unwatch = null; };
  revalidateReference = (): void => {
    if (!this.state.catalog) return;
    const reference = selectedReference(this.href(), this.state.catalog);
    if (reference.error) { this.editSequence++; this.reviewed = null; this.update({ referenceError: reference.error, phase: this.state.pending ? 'unconfirmed' : 'editing', errors: { ...this.state.errors, opcion: reference.error }, firstErrorField: 'opcion' }); return; }
    if (reference.present && reference.id && reference.id !== this.state.draft.opcion) { void this.editDraft({ opcion: reference.id, catalogoVersion: this.state.catalog.version, presentacionVersion: this.state.catalog.presentacionVersion }).catch(() => {}); }
    this.update({ referenceError: null });
  };
  chooseOption = async (id: string): Promise<void> => {
    const catalog = this.state.catalog;
    if (!catalog?.opciones.some(option => option.id === id)) throw new BookingError('INVALID_OPTION', 'Elige una opción disponible.', 400, 'opcion');
    this.update({ referenceError: null });
    await this.editDraft({ opcion: id, catalogoVersion: catalog.version, presentacionVersion: catalog.presentacionVersion });
  };
  setMediaReady = (ready: boolean): void => { if (!ready && this.state.mediaReady) { this.editSequence++; this.reviewed = null; } this.update({ mediaReady: ready, ...(!ready && this.state.phase === 'review' ? { phase: 'editing' } : {}) }); };
  private async draftLock<T>(callback: () => Promise<T>): Promise<T> {
    await this.ensureSession();
    if (!this.locks) throw new BookingError('LOCKS_UNAVAILABLE', 'No pudimos coordinar el borrador privado.');
    return this.locks.request(this.namespace + '-draft', callback);
  }
  private acceptEnvelope(envelope: DraftEnvelope, preserveCompetingDraft = false) {
    const conflict = preserveCompetingDraft && canonical(envelope.draft) !== canonical(this.state.draft) ? { localDraft: this.state.draft, server: envelope } : this.state.draftConflict;
    this.update({ revision: envelope.revision, lastValid: envelope.lastValid, pending: envelope.pending, recoveries: envelope.recoveries || [], editingRequiresChoice: Boolean(envelope.pending), ...(conflict ? { draftConflict: conflict } : {}) });
  }
  private async exposeConflict(): Promise<void> {
    const server = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador'));
    this.reviewed = null;
    this.update({ draftConflict: { localDraft: this.state.draft, server }, lastValid: server.lastValid, phase: this.state.pending ? 'unconfirmed' : 'editing', problem: { code: 'DRAFT_CONFLICT', message: 'El borrador cambió en otra vista. Compara ambos y elige cuál conservar.' } });
  }
  private async casDraft(patch: { expectedRevision: number; draft?: RawDraft; pending?: Pending | null }): Promise<DraftEnvelope> {
    try {
      const saved = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador', 'PATCH', patch));
      if (saved.revision !== patch.expectedRevision + 1 || (patch.draft && canonical(saved.draft) !== canonical(patch.draft))) throw new BookingError('INVALID_RESPONSE', 'El servidor no confirmó el borrador y su revisión exactos.');
      return saved;
    } catch (error) {
      if (error instanceof BookingError && error.code === 'DRAFT_CONFLICT') await this.exposeConflict();
      throw error;
    }
  }
  editDraft = (patch: Partial<RawDraft>): Promise<void> => {
    for (const key of Object.keys(patch)) if (!fields.includes(key as Field)) return Promise.reject(new BookingError('UNKNOWN_FIELD', 'El borrador contiene un campo desconocido.'));
    const local = { ...this.state.draft, ...copy(patch) };
    this.editSequence++; this.reviewed = null;
    const optionChanged = patch.opcion !== undefined && patch.opcion !== this.state.draft.opcion;
    const slotChanged = optionChanged || (patch.fecha !== undefined && patch.fecha !== this.state.draft.fecha);
    if (slotChanged) this.availabilitySequence++;
    this.update({ draft: local, phase: this.state.pending ? 'unconfirmed' : 'editing', editingRequiresChoice: Boolean(this.state.pending), record: null, errors: {}, firstErrorField: null, problem: this.state.draftConflict ? this.state.problem : null, ...(this.state.draftConflict ? { draftConflict: { ...this.state.draftConflict, localDraft: local } } : {}), ...(optionChanged ? { mediaReady: false } : {}), ...(slotChanged ? { availability: null, availabilityLoading: false } : {}) });
    const snapshot = copy(local);
    const work = this.writeQueue.catch(() => {}).then(() => this.draftLock(async () => {
      if (this.state.draftConflict) throw new BookingError('DRAFT_CONFLICT', 'Elige qué borrador conservar antes de volver a guardar.', 409);
      try {
        const saved = await this.casDraft({ draft: snapshot, expectedRevision: this.state.revision });
        this.acceptEnvelope(saved);
      } catch (error) {
        if (error instanceof BookingError && error.code === 'DRAFT_CONFLICT') await this.exposeConflict();
        throw error;
      }
    })).catch(error => { this.update({ problem: problem(error) }); throw error; });
    this.writeQueue = work; return work;
  };
  resolveDraftConflict = async (choice: 'use-server' | 'overwrite-local'): Promise<boolean> => {
    if (!['use-server', 'overwrite-local'].includes(choice)) throw new BookingError('INVALID_CHOICE', 'Elige un borrador para continuar.');
    const drained = this.writeQueue;
    await drained.catch(() => {});
    if (!this.state.draftConflict) return false;
    try {
      const resolved = await this.draftLock(async () => {
        const conflict = this.state.draftConflict;
        if (!conflict) return false;
        // Compare the exact server revision the person was shown; never fetch a
        // new revision and silently overwrite intervening edits.
        if (choice === 'overwrite-local') {
          const saved = await this.casDraft({ draft: this.state.draft, expectedRevision: conflict.server.revision });
          this.acceptEnvelope(saved); this.update({ draftConflict: null, problem: null });
        } else {
          const sequence = this.editSequence;
          const current = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador'));
          if (sequence !== this.editSequence || current.revision !== conflict.server.revision) { await this.exposeConflict(); return false; }
          this.editSequence++; this.availabilitySequence++; this.reviewed = null;
          this.acceptEnvelope(current);
          this.update({ draft: current.draft || emptyDraft(), draftConflict: null, mediaReady: false, availability: null, availabilityLoading: false, errors: {}, firstErrorField: null, record: null, problem: null });
        }
        return true;
      });
      if (resolved && this.writeQueue === drained) this.writeQueue = Promise.resolve();
      return resolved;
    } catch (error) {
      if (error instanceof BookingError && error.code === 'DRAFT_CONFLICT') await this.exposeConflict();
      this.update({ problem: problem(error) }); return false;
    }
  };
  loadAvailability = async (): Promise<Availability | null> => {
    const { opcion, fecha } = this.state.draft; const sequence = ++this.availabilitySequence;
    this.update({ availabilityLoading: true, availability: null, problem: null });
    try {
      const result = await this.api<Availability>('/api/disponibilidad?' + new URLSearchParams({ opcion, fecha }));
      if (result.opcion !== opcion || result.fecha !== fecha || !Array.isArray(result.turnos) || result.turnos.some(slot => !Number.isInteger(slot.disponibles) || slot.disponibles < 0)) throw new BookingError('INVALID_AVAILABILITY', 'No pudimos verificar los turnos disponibles.');
      if (sequence === this.availabilitySequence && this.state.draft.opcion === opcion && this.state.draft.fecha === fecha) this.update({ availability: result });
      return result;
    } catch (error) { if (sequence === this.availabilitySequence) this.update({ problem: problem(error) }); return null; }
    finally { if (sequence === this.availabilitySequence) this.update({ availabilityLoading: false }); }
  };
  review = (): CreatePayload | null => {
    if (this.state.draftConflict) { this.reviewed = null; this.update({ problem: { code: 'DRAFT_CONFLICT', message: 'Elige qué borrador conservar antes de revisar.' } }); return null; }
    const errors = validateDraft(this.state.draft, this.state.catalog, this.now(), this.state.referenceError, this.state.mediaReady);
    const availability = this.state.availability;
    if (!errors.hora && !errors.personas && (!availability || availability.opcion !== this.state.draft.opcion || availability.fecha !== this.state.draft.fecha || !availability.turnos.some(slot => slot.hora === this.state.draft.hora && slot.disponibles >= Number(this.state.draft.personas)))) errors.hora = 'Comprueba un turno con cupo disponible antes de continuar.';
    const firstErrorField = fields.find(field => Boolean(errors[field])) || null;
    if (this.state.pending) { this.update({ editingRequiresChoice: true, problem: { code: 'PENDING_DECISION_REQUIRED', message: 'Recupera el envío original o confirma que deseas iniciar otro intento antes de guardar.' } }); return null; }
    if (firstErrorField) { this.update({ phase: 'editing', errors, firstErrorField, problem: null }); return null; }
    const { paso: _step, ...raw } = this.state.draft;
    this.reviewed = immutable({ ...copy(raw), personas: Number(raw.personas), catalogoVersion: raw.catalogoVersion!, presentacionVersion: raw.presentacionVersion! });
    this.update({ phase: 'review', errors: {}, firstErrorField: null, problem: null });
    return copy(this.reviewed);
  };
  reviewServer = async (): Promise<ReviewSnapshot | null> => {
    const request = ++this.reviewSequence;
    let sequence: number | null = null;
    this.reviewed = null;
    try {
      await this.writeQueue;
      if (request !== this.reviewSequence) return null;
      const payload = this.review();
      this.reviewed = null;
      if (!payload) return null;
      sequence = this.editSequence;
      const revision = this.state.revision, catalog = this.state.catalog!;
      this.update({ phase: 'editing' });
      const result = await this.privateApi<ReviewSnapshot>('/api/revisiones', 'POST', { payload, expectedRevision: revision });
      if (request !== this.reviewSequence || sequence !== this.editSequence || revision !== this.state.revision || this.state.draftConflict || this.state.referenceError || !this.state.mediaReady) return null;
      const option = catalog.opciones.find(entry => entry.id === payload.opcion);
      if (!result || canonical(result.payload) !== canonical(payload) || canonical(result.opcion) !== canonical(option) || result.moneda !== catalog.moneda || result.zonaHoraria !== catalog.zonaHoraria || result.revision !== revision || typeof result.reviewedAt !== 'string' || !Number.isFinite(Date.parse(result.reviewedAt))) throw new BookingError('INVALID_REVIEW', 'La revisión del servidor no coincide con los datos y recursos elegidos.');
      this.reviewed = immutable(copy(payload));
      this.update({ lastValid: result, phase: 'review', errors: {}, firstErrorField: null, problem: null });
      return copy(result);
    } catch (error) {
      if (request !== this.reviewSequence || (sequence !== null && sequence !== this.editSequence)) return null;
      this.reviewed = null;
      if (error instanceof BookingError && error.code === 'DRAFT_CONFLICT') await this.exposeConflict();
      const issue = problem(error), field = issue.field && fields.includes(issue.field as Field) ? issue.field as Field : null;
      this.update({ phase: this.state.pending ? 'unconfirmed' : 'editing', problem: issue, errors: field ? { [field]: issue.message } : {}, firstErrorField: field });
      return null;
    }
  };
  private async persistPending(pending: Pending): Promise<void> {
    await this.writeQueue;
    await this.draftLock(async () => {
      const remote = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador'));
      if (remote.pending && remote.pending.clave !== pending.clave) { this.update({ pending: remote.pending, recoveries: remote.recoveries || [], phase: 'unconfirmed', editingRequiresChoice: true }); throw new BookingError('OTHER_PENDING_OPERATION', 'Hay otro envío pendiente en esta sesión. Recupéralo antes de continuar.'); }
      const knownIntent = remote.pending?.clave === pending.clave || remote.recoveries?.some(entry => entry.clave === pending.clave && canonical(entry) === canonical(pending));
      if (pending.tipo === 'crear' && !knownIntent && (this.state.draftConflict || (remote.revision !== this.state.revision && canonical(remote.draft) !== canonical(this.state.draft)))) { await this.exposeConflict(); throw new BookingError('DRAFT_CONFLICT', 'El borrador cambió antes del envío. Compara ambas versiones.', 409); }
      const saved = await this.casDraft({ pending, expectedRevision: remote.revision });
      if (canonical(saved.pending) !== canonical(pending)) throw new BookingError('PENDING_NOT_PERSISTED', 'No pudimos conservar el envío original de forma segura.');
      this.acceptEnvelope(saved, true);
    });
  }
  private assertSavedMatches(record: Reservation, pending: Pending) {
    if (pending.tipo === 'cancelar') { if (record.id !== pending.payload.id || record.estado !== 'cancelada') throw new BookingError('UNVERIFIED_RESULT', 'No pudimos verificar la cancelación.'); return; }
    const keys = ['opcion', 'fecha', 'hora', 'nombre', 'email', 'telefono', 'personas', 'notas', 'catalogoVersion', 'presentacionVersion'] as const;
    if (keys.some(key => record[key] !== pending.payload[key])) throw new BookingError('UNVERIFIED_RESULT', 'La reserva leída no coincide con el envío original.');
  }
  private async confirmed(result: unknown, pending: Pending): Promise<Reservation> {
    const returned = resultReservation(result);
    const record = resultReservation(await this.privateApi<unknown>('/api/reservas/' + encodeURIComponent(returned.id)));
    this.assertSavedMatches(record, pending);
    // Finish pending reconciliation before publishing visible success. A user may
    // reload as soon as the receipt appears; leave no avoidable pending race.
    let remaining: Pending | null = pending;
    let recoveries = this.state.recoveries;
    // Keep the frozen local intent if cleanup fails: reconciliation remains possible.
    try {
      const cleared = await this.draftLock(async () => {
        const current = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador'));
        return current.pending?.clave === pending.clave ? await this.casDraft({ pending: null, expectedRevision: current.revision }) : current;
      });
      remaining = cleared.pending;
      recoveries = cleared.recoveries || recoveries;
      this.acceptEnvelope(cleared, true);
    } catch { /* The authorized reread still proves this exact receipt. */ }
    // Confirmation is based on the authorized server reread, never local fields.
    this.update({ record, phase: 'confirmed', pending: remaining, recoveries, errors: {}, firstErrorField: null, problem: null, editingRequiresChoice: Boolean(remaining) });
    return record;
  }
  private async send(pending: Pending): Promise<Reservation | null> {
    this.update({ phase: 'saving', pending, problem: null });
    try {
      await this.persistPending(pending);
      const path = pending.tipo === 'crear' ? '/api/reservas' : '/api/reservas/' + encodeURIComponent(pending.payload.id) + '/cancelar';
      const result = await this.privateApi<unknown>(path, 'POST', pending.payload, pending.clave);
      return await this.confirmed(result, pending);
    } catch (error) {
      const issue = problem(error);
      const rejected = error instanceof BookingError && [400, 401, 403, 404, 409, 422].includes(error.status || 0);
      const errors = issue.field && fields.includes(issue.field as Field) ? { [issue.field]: issue.message } : {};
      this.update({ phase: rejected ? 'rejected' : 'unconfirmed', pending: this.state.pending || pending, problem: issue, errors, firstErrorField: issue.field && fields.includes(issue.field as Field) ? issue.field as Field : null });
      return null;
    }
  }
  save = (): Promise<Reservation | null> => {
    if (this.dispatchPromise) return this.dispatchPromise;
    if (this.state.pending) { this.update({ editingRequiresChoice: true, problem: { code: 'PENDING_DECISION_REQUIRED', message: 'Recupera el envío original antes de guardar otro intento.' } }); return Promise.resolve(null); }
    if (!this.reviewed || this.state.phase !== 'review') { this.update({ problem: { code: 'REVIEW_REQUIRED', message: 'Revisa todos los datos antes de guardar.' } }); return Promise.resolve(null); }
    let pending: Pending;
    try { pending = { tipo: 'crear', clave: this.key(), payload: copy(this.reviewed) }; }
    catch (error) { this.update({ problem: problem(error) }); return Promise.resolve(null); }
    this.dispatchPromise = this.send(assertPending(pending)).finally(() => { this.dispatchPromise = null; });
    return this.dispatchPromise;
  };
  cancel = (id: string): Promise<Reservation | null> => {
    if (this.dispatchPromise) return this.dispatchPromise;
    if (!UUID.test(id)) return Promise.reject(new BookingError('INVALID_RECORD', 'La reserva del enlace no es válida.'));
    if (this.state.pending) { this.update({ editingRequiresChoice: true, problem: { code: 'PENDING_DECISION_REQUIRED', message: 'Recupera el envío original antes de cancelar otra reserva.' } }); return Promise.resolve(null); }
    let pending: Pending;
    try { pending = { tipo: 'cancelar', clave: this.key(), payload: { id } }; }
    catch (error) { this.update({ problem: problem(error) }); return Promise.resolve(null); }
    this.dispatchPromise = this.send(assertPending(pending)).finally(() => { this.dispatchPromise = null; }); return this.dispatchPromise;
  };
  recoverPending = (): Promise<Reservation | null> => {
    if (this.dispatchPromise) return this.dispatchPromise;
    const pending = this.state.pending;
    if (!pending) return Promise.resolve(null);
    this.dispatchPromise = (async () => {
      this.update({ phase: 'saving', problem: null });
      try { const result = await this.privateApi<unknown>('/api/operaciones/' + encodeURIComponent(pending.clave)); return await this.confirmed(result, pending); }
      catch (error) {
        if (error instanceof BookingError && error.status === 404) return this.send(pending); // Absence is not proof of no commit: replay the original identity.
        this.update({ phase: 'unconfirmed', pending, problem: problem(error) }); return null;
      }
    })().finally(() => { this.dispatchPromise = null; }); return this.dispatchPromise;
  };
  startNewIntent = async (): Promise<boolean> => {
    await this.writeQueue;
    const original = this.state.pending;
    if (!original) { this.reviewed = null; this.update({ phase: 'editing', editingRequiresChoice: false }); return true; }
    try {
      const saved = await this.draftLock(async () => {
        const remote = assertDraftEnvelope(await this.api<DraftEnvelope>('/api/borrador'));
        if (remote.pending && remote.pending.clave !== original.clave) { this.update({ pending: remote.pending, recoveries: remote.recoveries || [] }); throw new BookingError('OTHER_PENDING_OPERATION', 'El envío pendiente cambió en otra vista. Revísalo antes de iniciar otro.'); }
        return this.casDraft({ pending: null, expectedRevision: remote.revision });
      });
      assertDraftEnvelope(saved);
      if (saved.pending || !saved.recoveries?.some(entry => entry.clave === original.clave && canonical(entry.payload) === canonical(original.payload))) throw new BookingError('RECOVERY_NOT_RETAINED', 'No pudimos conservar el envío anterior. Recupéralo antes de iniciar otro.');
      this.reviewed = null;
      this.acceptEnvelope(saved, true);
      this.update({ pending: null, recoveries: saved.recoveries, phase: 'editing', editingRequiresChoice: false, record: null, problem: null }); return true;
    } catch (error) { this.update({ pending: this.state.pending || original, phase: 'unconfirmed', problem: problem(error), editingRequiresChoice: true }); return false; }
  };
  activateRecovery = async (key: string): Promise<boolean> => {
    if (this.state.pending) { this.update({ problem: { code: 'PENDING_DECISION_REQUIRED', message: 'Resuelve el envío actual antes de recuperar uno anterior.' } }); return false; }
    const original = this.state.recoveries.find(entry => entry.clave === key);
    if (!original) throw new BookingError('UNKNOWN_RECOVERY', 'No encontramos ese envío en tu sesión.');
    try { await this.persistPending(original); this.update({ pending: original, phase: 'unconfirmed', editingRequiresChoice: false, problem: null }); return true; }
    catch (error) { this.update({ problem: problem(error) }); return false; }
  };
  loadReservations = async (): Promise<Reservation[]> => {
    try {
      const data = await this.privateApi<Reservation[] | { reservas: Reservation[] }>('/api/reservas');
      const rows = Array.isArray(data) ? data : data.reservas;
      if (!Array.isArray(rows)) throw new BookingError('INVALID_RESPONSE', 'No pudimos leer tus reservas.');
      const reservations = rows.map(assertReservation); this.update({ reservations, problem: null }); return reservations;
    } catch (error) { this.update({ problem: problem(error) }); throw error; }
  };
  loadRecord = async (id: string): Promise<Reservation> => {
    if (!UUID.test(id)) throw new BookingError('INVALID_RECORD', 'La reserva del enlace no es válida.');
    try { const record = resultReservation(await this.privateApi<unknown>('/api/reservas/' + encodeURIComponent(id))); this.update({ record, problem: null }); return record; }
    catch (error) { this.update({ record: null, problem: problem(error) }); throw error; }
  };
}

export function createBookingController(options: ControllerOptions = {}) { return new BookingController(options); }
