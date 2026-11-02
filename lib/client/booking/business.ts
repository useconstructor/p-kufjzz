import { BookingError, type BookingController } from './controller';
import type { Catalog, Reservation, Resource } from './types';

export type PublicOfferItem = { id: string; nombre: string; descripcion: string; precio: number; recursos: Resource[] };
export type BusinessCatalog = Catalog & { oferta?: PublicOfferItem[] };

function validResource(value: unknown): value is Resource {
  if (!value || typeof value !== 'object') return false;
  const r = value as Resource;
  return typeof r.id === 'string' && !!r.id && Number.isInteger(r.version) && r.version > 0 && typeof r.url === 'string' && r.url.startsWith('/') && !r.url.startsWith('//') && typeof r.sha256 === 'string' && /^[a-f\d]{64}$/i.test(r.sha256) && typeof r.alt === 'string' && !!r.alt.trim() && Number.isInteger(r.width) && Number(r.width) > 0 && Number.isInteger(r.height) && Number(r.height) > 0;
}

export async function fetchPublicCatalog(): Promise<BusinessCatalog> {
  const response = await fetch('/api/catalogo', { credentials: 'same-origin', cache: 'no-store' });
  const envelope = await response.json();
  if (!response.ok || envelope.ok !== true) throw new Error(envelope.error?.message || 'No pudimos cargar los talleres. Reintenta en un momento.');
  const c = envelope.data as BusinessCatalog;
  if (!c || !Number.isInteger(c.version) || !Number.isInteger(c.presentacionVersion) || typeof c.moneda !== 'string' || typeof c.zonaHoraria !== 'string' || !c.politica || !Array.isArray(c.opciones) || c.opciones.some(o => !o || typeof o.id !== 'string' || typeof o.nombre !== 'string' || typeof o.descripcion !== 'string' || !Number.isFinite(o.precio) || !Array.isArray(o.recursos) || !o.recursos.every(validResource))) throw new Error('El catálogo de talleres no está disponible en este momento.');
  return c;
}

export async function fetchPublicOffer(): Promise<{ moneda: string; items: PublicOfferItem[] }> {
  const catalog = await fetchPublicCatalog();
  // Una oferta adicional solo se presenta si el catálogo la publica explícitamente.
  if (!Array.isArray(catalog.oferta)) throw new Error('No hay una oferta adicional publicada.');
  if (catalog.oferta.some(o => !o || typeof o.id !== 'string' || typeof o.nombre !== 'string' || typeof o.descripcion !== 'string' || !Number.isFinite(o.precio) || o.precio < 0 || !Array.isArray(o.recursos) || !o.recursos.length || !o.recursos.every(validResource))) throw new Error('No pudimos comprobar la oferta completa.');
  return { moneda: catalog.moneda, items: catalog.oferta };
}

export const bookingHref = (id: string) => '/reservar?' + new URLSearchParams({ opcion: id });
export const confirmationHref = (record: Reservation) => '/confirmacion?' + new URLSearchParams({ id: record.id });
export const detailHref = (record: Reservation) => '/detalle-reserva?' + new URLSearchParams({ id: record.id });
export async function loadOwnedCode(controller: BookingController, codigo: string): Promise<Reservation> {
  const rows = await controller.loadReservations();
  const record = rows.find(row => row.codigo === codigo.trim());
  if (!record) throw new BookingError('NOT_FOUND', 'No encontramos esa reserva en esta sesión.', 404);
  return controller.loadRecord(record.id);
}
export const formatDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : value || 'Fecha por elegir';
export const localToday = (zone: string, now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

// Start on the next scheduled day, without changing an existing saved draft.
export function nextScheduledDate(catalog: Catalog, now = new Date()): string {
  const today = localToday(catalog.zonaHoraria, now);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: catalog.zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const date = new Date(today + 'T12:00:00Z');
  for (let offset = 0; offset < 8; offset++) {
    const day = date.toISOString().slice(0, 10);
    if (catalog.politica.diasSemana.includes(date.getUTCDay()) && catalog.politica.horas.some(time => offset > 0 || time > clock)) return day;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return today;
}
