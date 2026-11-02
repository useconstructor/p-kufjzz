import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Client, Transaction } from '@libsql/client';

export type Resource = { id: string; version: number; url: string; sha256: string; alt: string; width?: number; height?: number };
export type Option = { id: string; nombre: string; descripcion: string; precio: number; duracionMinutos: number; recursos: Resource[] };
export type Policy = { diasSemana: number[]; horas: string[]; minPersonas: number; maxPersonas: number; capacidad: number; capacidadCompartida: boolean };
export type CatalogData = { version: number; presentacionVersion: number; moneda: string; zonaHoraria: string; opciones: Option[]; politica: Policy };
export type BookingConfig = { catalog: CatalogData; appOrigin: string; vercelUrl?: string; namespace: string; cookieName?: string };
export type RawDraft = { opcion: string; fecha: string; hora: string; nombre: string; email: string; telefono: string; personas: string; notas: string; catalogoVersion: number | null; presentacionVersion: number | null; paso: string };
export type CreatePayload = Omit<RawDraft, 'personas' | 'catalogoVersion' | 'presentacionVersion' | 'paso'> & { personas: number; catalogoVersion: number; presentacionVersion: number };
export type Pending = { tipo: 'crear'; clave: string; payload: CreatePayload } | { tipo: 'cancelar'; clave: string; payload: { id: string } };
export type ReviewSnapshot = { payload: CreatePayload; opcion: Option; moneda: string; zonaHoraria: string; revision: number; reviewedAt: string };
export type DraftState = { draft: RawDraft | null; pending: Pending | null; recoveries: Pending[]; revision: number; lastValid: ReviewSnapshot | null };
export type Reservation = {
  id: string; codigo: string; opcion: string; opcionNombre: string; opcionDescripcion: string; precio: number; moneda: string;
  duracionMinutos: number; fecha: string; hora: string; zonaHoraria: string; inicioUtc: string; finUtc: string;
  nombre: string; email: string; telefono: string; personas: number; notas: string; estado: 'activa' | 'cancelada';
  catalogoVersion: number; presentacionVersion: number; recursos: Resource[]; createdAt: string; updatedAt: string; cancelledAt: string | null;
};
export type Availability = { opcion: string; fecha: string; turnos: { hora: string; disponibles: number; inicioUtc: string }[] };

class BookingError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}
const absent = () => new BookingError(404, 'NO_ENCONTRADO', 'No encontramos este registro.');
const invalid = (field: string, message: string, code = 'CAMPO_INVALIDO') => new BookingError(400, code, message, field);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const inputKeys = ['opcion', 'fecha', 'hora', 'nombre', 'email', 'telefono', 'personas', 'notas', 'catalogoVersion', 'presentacionVersion'];
const stringKeys = ['opcion', 'fecha', 'hora', 'nombre', 'email', 'telefono', 'notas'] as const;
const queuedWrites = new WeakMap<Client, Promise<unknown>>();
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('body', 'Envía un objeto JSON.');
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(value).find(k => !allowed.includes(k));
  if (extra) throw invalid(extra, 'Este campo no está permitido.', 'CAMPO_DESCONOCIDO');
}
async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (Buffer.byteLength(text) > 32768) throw new BookingError(413, 'SOLICITUD_GRANDE', 'La solicitud es demasiado grande.');
  let result: unknown;
  try { result = text ? JSON.parse(text) : {}; } catch { throw invalid('body', 'El JSON no es válido.'); }
  object(result); return result;
}
function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ ok: true, data }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}
function jsonError(error: BookingError) {
  return new Response(JSON.stringify({ ok: false, error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } }), { status: error.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function configOrigin(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid trusted booking origin');
  return url.origin;
}
function structurePayload(value: unknown): CreatePayload {
  object(value); keys(value, inputKeys);
  for (const key of stringKeys) if (typeof value[key] !== 'string') throw invalid(key, 'Este campo debe ser texto.');
  for (const key of ['personas', 'catalogoVersion', 'presentacionVersion']) if (!Number.isSafeInteger(value[key])) throw invalid(key, 'Este campo debe ser un número entero.');
  return value as unknown as CreatePayload;
}
function rawDraft(value: unknown): RawDraft {
  object(value); keys(value, [...inputKeys, 'paso']);
  for (const key of [...stringKeys, 'personas', 'paso']) if (typeof value[key] !== 'string' || (value[key] as string).length > (key === 'notas' ? 2000 : 500)) throw invalid(key, 'No pudimos guardar este campo.');
  for (const key of ['catalogoVersion', 'presentacionVersion']) if (value[key] !== null && !Number.isSafeInteger(value[key])) throw invalid(key, 'La referencia no es válida.');
  return value as unknown as RawDraft;
}
function pending(value: unknown): Pending {
  object(value); keys(value, ['tipo', 'clave', 'payload']);
  if (typeof value.clave !== 'string' || !UUID.test(value.clave)) throw invalid('clave', 'La clave de operación no es válida.');
  if (value.tipo === 'crear') return { tipo: 'crear', clave: value.clave, payload: structurePayload(value.payload) };
  if (value.tipo === 'cancelar') {
    object(value.payload); keys(value.payload, ['id']);
    if (typeof value.payload.id !== 'string' || !UUID.test(value.payload.id)) throw invalid('id', 'La referencia no es válida.');
    return { tipo: 'cancelar', clave: value.clave, payload: { id: value.payload.id } };
  }
  throw invalid('tipo', 'La operación no es válida.');
}
function validDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1900) throw invalid('fecha', 'Elige una fecha válida.', 'FECHA_INVALIDA');
  const stamp = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date) throw invalid('fecha', 'Elige una fecha válida.', 'FECHA_INVALIDA');
  return stamp;
}
function zonedParts(stamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(stamp));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, equivalent: Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) };
}
function instant(date: string, time: string, timezone: string): number {
  validDate(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid('hora', 'Elige una hora válida.', 'HORA_INVALIDA');
  const desired = Date.parse(date + 'T' + time + ':00Z');
  let result = desired;
  for (let i = 0; i < 4; i++) result += desired - zonedParts(result, timezone).equivalent;
  const actual = zonedParts(result, timezone);
  if (actual.date !== date || actual.time !== time) throw invalid('hora', 'Este horario no existe en la zona horaria.', 'HORA_INVALIDA');
  for (const delta of [-3600000, 3600000]) {
    const alternate = zonedParts(result + delta, timezone);
    if (alternate.date === date && alternate.time === time) throw invalid('hora', 'Este horario es ambiguo; elige otro turno.', 'HORA_AMBIGUA');
  }
  return result;
}
function busy(error: unknown) { return error instanceof Error && /SQLITE_BUSY|SQLITE_LOCKED|database is locked|database table is locked/i.test(error.message); }
async function write<T>(db: Client, action: (transaction: Transaction) => Promise<T>): Promise<T> {
  const previous = queuedWrites.get(db) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    for (let attempt = 0; ; attempt++) {
      let tx: Transaction | undefined;
      try { tx = await db.transaction('write'); const result = await action(tx); await tx.commit(); return result; }
      catch (error) { tx?.close(); if (!busy(error) || attempt >= 7) throw error; await new Promise(resolve => setTimeout(resolve, Math.min(160, 10 * 2 ** attempt))); }
      finally { tx?.close(); }
    }
  });
  queuedWrites.set(db, run);
  return run;
}
function validateConfig(config: BookingConfig) {
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(config.namespace)) throw Error('Invalid booking namespace');
  const catalog = config.catalog;
  configOrigin(config.appOrigin);
  if (!Number.isSafeInteger(catalog.version) || catalog.version < 1 || !Number.isSafeInteger(catalog.presentacionVersion) || catalog.presentacionVersion < 1) throw Error('Invalid catalog version');
  new Intl.DateTimeFormat('en', { timeZone: catalog.zonaHoraria });
  if (!/^[A-Z]{3}$/.test(catalog.moneda)) throw Error('Invalid catalog currency');
  const p = catalog.politica;
  if (![p.minPersonas, p.maxPersonas, p.capacidad].every(x => Number.isSafeInteger(x) && x >= 1) || p.minPersonas > p.maxPersonas || p.maxPersonas > p.capacidad || typeof p.capacidadCompartida !== 'boolean') throw Error('Invalid capacity policy');
  if (!p.diasSemana.length || p.diasSemana.some(x => !Number.isInteger(x) || x < 0 || x > 6) || new Set(p.diasSemana).size !== p.diasSemana.length || !p.horas.length || p.horas.some(x => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) || new Set(p.horas).size !== p.horas.length) throw Error('Invalid opening policy');
  const ids = new Set<string>();
  if (!catalog.opciones.length) throw Error('Empty booking catalog');
  for (const option of catalog.opciones) {
    if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(option.id) || ids.has(option.id) || !option.nombre || !option.descripcion || !Number.isSafeInteger(option.precio) || option.precio < 0 || !Number.isSafeInteger(option.duracionMinutos) || option.duracionMinutos < 1 || option.duracionMinutos > 1440) throw Error('Invalid catalog option');
    ids.add(option.id);
    for (const resource of option.recursos) if (!resource.id || !Number.isSafeInteger(resource.version) || resource.version < 1 || !/^[a-f0-9]{64}$/i.test(resource.sha256) || !resource.alt || !resource.url.startsWith('/') || resource.url.startsWith('//') || /[?#\\]|(?:^|\/)\.\.(?:\/|$)/.test(resource.url) || ((resource.width !== undefined || resource.height !== undefined) && (![resource.width, resource.height].every(x => Number.isSafeInteger(x) && Number(x) > 0)))) throw Error('Invalid canonical media resource');
  }
  if (config.cookieName && !/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(config.cookieName)) throw Error('Invalid private cookie name');
}

export function createBookingHandlers(options: { db: Client; config: BookingConfig; now?: () => number }) {
  validateConfig(options.config);
  const config: BookingConfig = JSON.parse(JSON.stringify(options.config));
  const catalog = config.catalog;
  const db = options.db;
  const now = options.now ?? Date.now;
  const prefix = config.namespace;
  const table = (name: string) => `"${prefix}_${name}"`;
  const sessions = table('sesiones'), drafts = table('borradores'), reservations = table('reservas'), operations = table('operaciones'), catalogs = table('catalogos');
  const cookieName = config.cookieName ?? `${prefix}_reserva`;
  const trustedOrigins = new Set([configOrigin(config.appOrigin), ...(config.vercelUrl ? [configOrigin(config.vercelUrl.includes('://') ? config.vercelUrl : 'https://' + config.vercelUrl)] : [])]);
  const secure = new URL(config.appOrigin).protocol === 'https:';
  let readyPromise: Promise<void> | undefined;
  function ready() {
    if (!readyPromise) readyPromise = write(db, async tx => {
      await tx.executeMultiple(`
CREATE TABLE IF NOT EXISTS ${sessions}(owner TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ${drafts}(owner TEXT PRIMARY KEY, draft TEXT, pending TEXT, retained TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), last_valid TEXT);
CREATE TABLE IF NOT EXISTS ${catalogs}(version INTEGER PRIMARY KEY, presentation INTEGER NOT NULL, fingerprint TEXT NOT NULL, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ${reservations}(id TEXT PRIMARY KEY, owner TEXT NOT NULL, option TEXT NOT NULL, scope TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, people INTEGER NOT NULL CHECK(people>0), status TEXT NOT NULL CHECK(status IN ('activa','cancelada')), document TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS "${prefix}_reservas_capacidad" ON ${reservations}(scope,status,start,end);
CREATE INDEX IF NOT EXISTS "${prefix}_reservas_owner" ON ${reservations}(owner);
CREATE TABLE IF NOT EXISTS ${operations}(owner TEXT NOT NULL, key TEXT NOT NULL, type TEXT NOT NULL, fingerprint TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(owner,key));
`);
      // Additive migration: preserve all existing owner/draft/frozen records.
      const columns = await tx.execute(`PRAGMA table_info(${drafts})`);
      const names = new Set(columns.rows.map(row => String(row.name)));
      if (!names.has('revision')) await tx.execute(`ALTER TABLE ${drafts} ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)`);
      if (!names.has('last_valid')) await tx.execute(`ALTER TABLE ${drafts} ADD COLUMN last_valid TEXT`);
      const existing = await tx.execute({ sql: `SELECT fingerprint FROM ${catalogs} WHERE version=?`, args: [catalog.version] });
      const fingerprint = hash(canonical(catalog));
      if (existing.rows.length && existing.rows[0].fingerprint !== fingerprint) throw Error('A catalog version is immutable; provide a new version');
      await tx.execute({ sql: `INSERT OR IGNORE INTO ${catalogs}(version,presentation,fingerprint,document) VALUES(?,?,?,?)`, args: [catalog.version, catalog.presentacionVersion, fingerprint, JSON.stringify(catalog)] });
    }).catch(error => { readyPromise = undefined; throw error; });
    return readyPromise;
  }
  function origin(request: Request) {
    const received = request.headers.get('origin');
    if (!received || !trustedOrigins.has(received)) throw new BookingError(403, 'ORIGEN_NO_PERMITIDO', 'Esta solicitud no está autorizada.');
  }
  async function owner(request: Request): Promise<string | null> {
    const matches = (request.headers.get('cookie') ?? '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName + '='));
    if (matches.length !== 1) return null;
    const token = matches[0].slice(cookieName.length + 1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const digest = hash(token);
    const result = await db.execute({ sql: `SELECT owner FROM ${sessions} WHERE owner=? AND expires>?`, args: [digest, now()] });
    return result.rows.length ? digest : null;
  }
  async function requiredOwner(request: Request) {
    const result = await owner(request);
    if (!result) throw new BookingError(401, 'SESION_REQUERIDA', 'Inicializa una sesión privada para continuar.');
    return result;
  }
  function opKey(request: Request) {
    const result = request.headers.get('idempotency-key') ?? '';
    if (!UUID.test(result)) throw invalid('clave', 'La clave de operación no es válida.', 'CLAVE_INVALIDA');
    return result;
  }
  async function record(executor: Client | Transaction, id: string, actor: string) {
    const result = await executor.execute({ sql: `SELECT document FROM ${reservations} WHERE id=? AND owner=?`, args: [id, actor] });
    if (!result.rows.length) throw absent();
    return JSON.parse(String(result.rows[0].document)) as Reservation;
  }
  async function existingOperation(tx: Transaction, actor: string, key: string, type: string, fingerprint: string) {
    const result = await tx.execute({ sql: `SELECT type,fingerprint,record FROM ${operations} WHERE owner=? AND key=?`, args: [actor, key] });
    if (!result.rows.length) return null;
    if (result.rows[0].type !== type || result.rows[0].fingerprint !== fingerprint) throw new BookingError(409, 'CLAVE_REUTILIZADA', 'Esta clave pertenece a otra solicitud.');
    return record(tx, String(result.rows[0].record), actor);
  }
  async function verifyFrozen(tx: Transaction, actor: string, intent: Pending) {
    const result = await tx.execute({ sql: `SELECT pending,retained FROM ${drafts} WHERE owner=?`, args: [actor] });
    const row = result.rows[0];
    const snapshots: Pending[] = row?.retained ? JSON.parse(String(row.retained)) : [];
    if (row?.pending) snapshots.push(JSON.parse(String(row.pending)));
    if (snapshots.some(snapshot => snapshot.clave === intent.clave && canonical(snapshot) !== canonical(intent))) throw new BookingError(409, 'CLAVE_REUTILIZADA', 'Esta clave pertenece a otra solicitud.');
  }
  function validate(payload: CreatePayload) {
    const option = catalog.opciones.find(x => x.id === payload.opcion);
    if (!option) throw invalid('opcion', 'Elige una opción válida.', 'OPCION_INVALIDA');
    if (payload.catalogoVersion !== catalog.version || payload.presentacionVersion !== catalog.presentacionVersion) throw new BookingError(409, 'REFERENCIA_CAMBIADA', 'La opción cambió; revisa la información antes de guardar.', 'opcion');
    if (payload.nombre.trim().length < 2 || payload.nombre.length > 120 || /[\u0000-\u001f\u007f]/.test(payload.nombre)) throw invalid('nombre', 'Escribe un nombre de 2 a 120 caracteres.', 'NOMBRE_INVALIDO');
    if (payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw invalid('email', 'Escribe un email válido.', 'EMAIL_INVALIDO');
    if (payload.telefono.length > 40 || !/^\+?[0-9 ()-]+$/.test(payload.telefono) || payload.telefono.replace(/\D/g, '').length < 7 || payload.telefono.replace(/\D/g, '').length > 15) throw invalid('telefono', 'Escribe un teléfono de 7 a 15 dígitos.', 'TELEFONO_INVALIDO');
    if (payload.notas.length > 2000 || /[\u0000\u000b\u000c]/.test(payload.notas)) throw invalid('notas', 'Las notas admiten hasta 2000 caracteres.', 'NOTAS_INVALIDAS');
    if (payload.personas < catalog.politica.minPersonas || payload.personas > catalog.politica.maxPersonas) throw invalid('personas', `Elige entre ${catalog.politica.minPersonas} y ${catalog.politica.maxPersonas} personas.`, 'PERSONAS_INVALIDAS');
    const date = validDate(payload.fecha);
    if (!catalog.politica.diasSemana.includes(new Date(date).getUTCDay())) throw invalid('fecha', 'No hay turnos ese día.', 'DIA_CERRADO');
    if (!catalog.politica.horas.includes(payload.hora)) throw invalid('hora', 'Elige un turno dentro del horario.', 'FUERA_DE_HORARIO');
    const start = instant(payload.fecha, payload.hora, catalog.zonaHoraria);
    if (start <= now()) throw invalid('fecha', 'Elige un turno futuro.', 'TURNO_PASADO');
    return { option, start, end: start + option.duracionMinutos * 60000, scope: catalog.politica.capacidadCompartida ? '*' : option.id };
  }
  async function used(executor: Client | Transaction, scope: string, start: number, end: number) {
    const result = await executor.execute({ sql: `SELECT start,end,people FROM ${reservations} WHERE status='activa' AND start<? AND end>?${scope === '*' ? '' : ' AND option=?'}`, args: scope === '*' ? [end, start] : [end, start, scope] });
    const events = result.rows.flatMap(row => [
      { time: Math.max(start, Number(row.start)), delta: Number(row.people) },
      { time: Math.min(end, Number(row.end)), delta: -Number(row.people) },
    ]).sort((a, b) => a.time - b.time || a.delta - b.delta);
    let current = 0, peak = 0;
    for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
    return peak;
  }
  async function create(request: Request, actor: string) {
    const key = opKey(request);
    const payload = structurePayload(await readJson(request));
    const fingerprint = hash(canonical(payload));
    const result = await write(db, async tx => {
      await verifyFrozen(tx, actor, { tipo: 'crear', clave: key, payload });
      const replay = await existingOperation(tx, actor, key, 'crear', fingerprint);
      if (replay) return replay;
      const { option, start, end, scope } = validate(payload);
      if (await used(tx, scope, start, end) + payload.personas > catalog.politica.capacidad) throw new BookingError(409, 'TURNO_OCUPADO', 'No hay cupo suficiente. Elige otro turno.', 'hora');
      const timestamp = new Date(now()).toISOString();
      const reservation: Reservation = {
        id: randomUUID(), codigo: randomBytes(5).toString('hex').toUpperCase(), opcion: option.id, opcionNombre: option.nombre, opcionDescripcion: option.descripcion,
        precio: option.precio, moneda: catalog.moneda, duracionMinutos: option.duracionMinutos, fecha: payload.fecha, hora: payload.hora, zonaHoraria: catalog.zonaHoraria,
        inicioUtc: new Date(start).toISOString(), finUtc: new Date(end).toISOString(), nombre: payload.nombre, email: payload.email, telefono: payload.telefono, personas: payload.personas, notas: payload.notas,
        estado: 'activa', catalogoVersion: catalog.version, presentacionVersion: catalog.presentacionVersion, recursos: JSON.parse(JSON.stringify(option.recursos)), createdAt: timestamp, updatedAt: timestamp, cancelledAt: null,
      };
      await tx.execute({ sql: `INSERT INTO ${reservations}(id,owner,option,scope,start,end,people,status,document) VALUES(?,?,?,?,?,?,?,?,?)`, args: [reservation.id, actor, option.id, scope, start, end, payload.personas, 'activa', JSON.stringify(reservation)] });
      await tx.execute({ sql: `INSERT INTO ${operations}(owner,key,type,fingerprint,record) VALUES(?,?,?,?,?)`, args: [actor, key, 'crear', fingerprint, reservation.id] });
      return reservation;
    });
    return json(result, 201);
  }
  async function cancel(request: Request, actor: string, id: string) {
    const key = opKey(request);
    const body = await readJson(request); keys(body, ['id']);
    if (body.id !== undefined && body.id !== id) throw invalid('id', 'La referencia no coincide.');
    const fingerprint = hash(canonical({ id }));
    const result = await write(db, async tx => {
      await verifyFrozen(tx, actor, { tipo: 'cancelar', clave: key, payload: { id } });
      const replay = await existingOperation(tx, actor, key, 'cancelar', fingerprint);
      if (replay) return replay;
      const reservation = await record(tx, id, actor);
      if (reservation.estado === 'activa') {
        reservation.estado = 'cancelada'; reservation.cancelledAt = new Date(now()).toISOString(); reservation.updatedAt = reservation.cancelledAt;
        await tx.execute({ sql: `UPDATE ${reservations} SET status='cancelada',document=? WHERE id=? AND owner=?`, args: [JSON.stringify(reservation), id, actor] });
      }
      await tx.execute({ sql: `INSERT INTO ${operations}(owner,key,type,fingerprint,record) VALUES(?,?,?,?,?)`, args: [actor, key, 'cancelar', fingerprint, id] });
      return reservation;
    });
    return json(result);
  }
  async function draft(request: Request, actor: string) {
    if (request.method === 'GET') {
      return json(await readDraft(db, actor));
    }
    const body = await readJson(request); keys(body, ['draft', 'pending', 'nuevaIntencion', 'expectedRevision']);
    const expected = body.expectedRevision === undefined ? undefined : expectedRevision(body.expectedRevision);
    if (body.nuevaIntencion !== undefined && typeof body.nuevaIntencion !== 'boolean') throw invalid('nuevaIntencion', 'La elección no es válida.');
    const nextDraft = body.draft !== undefined ? (body.draft === null ? null : rawDraft(body.draft)) : undefined;
    const nextPending = body.pending !== undefined ? (body.pending === null ? null : pending(body.pending)) : undefined;
    const state = await write(db, async tx => {
      const state = await readDraft(tx, actor);
      if (expected !== undefined && state.revision !== expected) throw draftConflict();
      if (nextPending !== undefined && state.pending && canonical(state.pending) !== canonical(nextPending)) {
        const op = await tx.execute({ sql: `SELECT key FROM ${operations} WHERE owner=? AND key=?`, args: [actor, state.pending.clave] });
        if (!op.rows.length && nextPending !== null && body.nuevaIntencion !== true) throw new BookingError(409, 'ENVIO_PENDIENTE', 'Recupera el envío original o elige expresamente una nueva intención.');
        if (!state.recoveries.some(x => x.clave === state.pending!.clave)) state.recoveries.push(state.pending);
      }
      if (nextPending && state.pending?.clave === nextPending.clave && canonical(state.pending) !== canonical(nextPending)) throw new BookingError(409, 'CLAVE_REUTILIZADA', 'Esta clave pertenece a otra solicitud.');
      if (nextPending && state.recoveries.some(x => x.clave === nextPending.clave && canonical(x) !== canonical(nextPending))) throw new BookingError(409, 'CLAVE_REUTILIZADA', 'Esta clave pertenece a otra solicitud.');
      if (nextDraft !== undefined) state.draft = nextDraft;
      if (nextPending !== undefined) state.pending = nextPending;
      if (state.revision >= Number.MAX_SAFE_INTEGER) throw draftConflict();
      state.revision++;
      await tx.execute({ sql: `INSERT INTO ${drafts}(owner,draft,pending,retained,revision,last_valid) VALUES(?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET draft=excluded.draft,pending=excluded.pending,retained=excluded.retained,revision=excluded.revision,last_valid=excluded.last_valid`, args: [actor, state.draft ? JSON.stringify(state.draft) : null, state.pending ? JSON.stringify(state.pending) : null, JSON.stringify(state.recoveries), state.revision, state.lastValid ? JSON.stringify(state.lastValid) : null] });
      return state;
    });
    return json(state);
  }
  function expectedRevision(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw invalid('expectedRevision', 'La revisión del borrador debe ser un entero válido.', 'REVISION_INVALIDA');
    return Number(value);
  }
  function draftConflict() { return new BookingError(409, 'DRAFT_CONFLICT', 'El borrador cambió. Consulta tus datos actuales antes de continuar.', 'draft'); }
  async function readDraft(executor: Client | Transaction, actor: string): Promise<DraftState> {
    const result = await executor.execute({ sql: `SELECT draft,pending,retained,revision,last_valid FROM ${drafts} WHERE owner=?`, args: [actor] });
    const row = result.rows[0];
    return { draft: row?.draft ? JSON.parse(String(row.draft)) : null, pending: row?.pending ? JSON.parse(String(row.pending)) : null, recoveries: row?.retained ? JSON.parse(String(row.retained)) : [], revision: row ? Number(row.revision) : 0, lastValid: row?.last_valid ? JSON.parse(String(row.last_valid)) : null };
  }
  async function review(request: Request, actor: string) {
    const body = await readJson(request); keys(body, ['payload', 'expectedRevision']);
    const expected = expectedRevision(body.expectedRevision);
    const payload = structurePayload(body.payload);
    const snapshot = await write(db, async tx => {
      const state = await readDraft(tx, actor);
      if (state.revision !== expected || !state.draft) throw draftConflict();
      const { paso: _step, ...raw } = state.draft;
      const fromDraft = { ...raw, personas: Number(raw.personas), catalogoVersion: raw.catalogoVersion ?? catalog.version, presentacionVersion: raw.presentacionVersion ?? catalog.presentacionVersion };
      if (canonical(payload) !== canonical(fromDraft)) throw draftConflict();
      if (state.pending) throw new BookingError(409, 'ENVIO_PENDIENTE', 'Recupera el envío original antes de revisar otro intento.');
      const { option, start, end, scope } = validate(payload);
      if (await used(tx, scope, start, end) + payload.personas > catalog.politica.capacidad) throw new BookingError(409, 'TURNO_OCUPADO', 'No hay cupo suficiente. Elige otro turno.', 'hora');
      const lastValid: ReviewSnapshot = JSON.parse(JSON.stringify({ payload, opcion: option, moneda: catalog.moneda, zonaHoraria: catalog.zonaHoraria, revision: state.revision, reviewedAt: new Date(now()).toISOString() }));
      await tx.execute({ sql: `UPDATE ${drafts} SET last_valid=? WHERE owner=?`, args: [JSON.stringify(lastValid), actor] });
      return lastValid;
    });
    return json(snapshot);
  }
  async function availability(url: URL) {
    const option = catalog.opciones.find(x => x.id === url.searchParams.get('opcion'));
    if (!option) throw invalid('opcion', 'Elige una opción válida.', 'OPCION_INVALIDA');
    const date = url.searchParams.get('fecha') ?? '';
    const stamp = validDate(date);
    if (!catalog.politica.diasSemana.includes(new Date(stamp).getUTCDay())) return json({ opcion: option.id, fecha: date, turnos: [] } satisfies Availability);
    const minimum = Number(url.searchParams.get('personas') ?? catalog.politica.minPersonas);
    if (!Number.isSafeInteger(minimum) || minimum < catalog.politica.minPersonas || minimum > catalog.politica.maxPersonas) throw invalid('personas', 'La cantidad de personas no es válida.', 'PERSONAS_INVALIDAS');
    const scope = catalog.politica.capacidadCompartida ? '*' : option.id;
    const hours = [];
    for (const time of catalog.politica.horas) {
      let start: number;
      try { start = instant(date, time, catalog.zonaHoraria); } catch { continue; }
      const seats = Math.max(0, catalog.politica.capacidad - await used(db, scope, start, start + option.duracionMinutos * 60000));
      hours.push({ hora: time, disponibles: start > now() ? seats : 0, inicioUtc: new Date(start).toISOString() });
    }
    return json({ opcion: option.id, fecha: date, turnos: hours } satisfies Availability);
  }
  async function handle(request: Request): Promise<Response> {
    try {
      await ready();
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, '');
      if (!['GET', 'POST', 'PATCH'].includes(request.method)) return jsonError(new BookingError(405, 'METODO_NO_PERMITIDO', 'Este método no está permitido.'));
      if (request.method !== 'GET') origin(request);
      if (path === '/api/catalogo' && request.method === 'GET') return json(catalog);
      if (path === '/api/disponibilidad' && request.method === 'GET') return await availability(url);
      if (path === '/api/sesion') {
        if (request.method === 'POST') {
          const body = await readJson(request); keys(body, []);
          if (await owner(request)) return json({ verified: true });
          const token = randomBytes(32).toString('base64url');
          await db.execute({ sql: `INSERT INTO ${sessions}(owner,expires) VALUES(?,?)`, args: [hash(token), now() + 30 * 86400000] });
          const flags = secure ? '; Secure; SameSite=None; Partitioned' : '; SameSite=Lax';
          return json({ verified: true }, 200, { 'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; Max-Age=2592000${flags}` });
        }
        if (request.method === 'GET') { await requiredOwner(request); return json({ verified: true }); }
        throw absent();
      }
      const actor = await requiredOwner(request);
      if (path === '/api/revisiones' && request.method === 'POST') return await review(request, actor);
      if (path === '/api/borrador' && ['GET', 'PATCH'].includes(request.method)) return await draft(request, actor);
      if (path === '/api/reservas' && request.method === 'POST') return await create(request, actor);
      if (path === '/api/reservas' && request.method === 'GET') {
        const result = await db.execute({ sql: `SELECT document FROM ${reservations} WHERE owner=? ORDER BY start,id`, args: [actor] });
        return json(result.rows.map(row => JSON.parse(String(row.document)) as Reservation));
      }
      const detail = path.match(/^\/api\/reservas\/([^/]+)$/);
      if (detail && request.method === 'GET') return json(await record(db, detail[1], actor));
      const cancellation = path.match(/^\/api\/reservas\/([^/]+)\/cancelar$/);
      if (cancellation && request.method === 'POST') return await cancel(request, actor, cancellation[1]);
      const operation = path.match(/^\/api\/operaciones\/([^/]+)$/);
      if (operation && request.method === 'GET') {
        const result = await db.execute({ sql: `SELECT type,record FROM ${operations} WHERE owner=? AND key=?`, args: [actor, operation[1]] });
        if (!result.rows.length) throw absent();
        return json({ tipo: result.rows[0].type, clave: operation[1], reserva: await record(db, String(result.rows[0].record), actor) });
      }
      throw absent();
    } catch (error) { return jsonError(error instanceof BookingError ? error : new BookingError(503, 'SERVICIO_NO_DISPONIBLE', 'No pudimos completar la solicitud. Conserva tus datos e intenta de nuevo.')); }
  }
  return { handle, ready };
}
