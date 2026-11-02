import 'server-only';
import type { BookingConfig, CatalogData, Resource } from './booking-engine';

const resource: Resource = { id: 'vuelta-context-1', version: 1, url: '/images/booking-context-1-v1.jpg', sha256: '039254825d69a009eeb2d4814f0291d350800c86bd40fef71eb5e4852f77734b', alt: 'Manos modelando barro sobre un torno; fotografía representativa de Violinistman en Egipto, 2024.', height: 2000, width: 2500 };
const catalog: CatalogData = {
  version: 1, presentacionVersion: 1, moneda: 'COP', zonaHoraria: 'America/Bogota',
  opciones: [
    { id: 'primera-taza', nombre: 'Primera taza', descripcion: 'Explora el modelado a mano: forma un cuerpo, añade un asa y descubre el ritmo del barro. Experiencia de demostración.', precio: 90000, duracionMinutos: 120, recursos: [resource] },
    { id: 'torno-inicial', nombre: 'Torno inicial', descripcion: 'Una introducción al centrado y a las primeras formas sobre el torno. Experiencia de demostración.', precio: 120000, duracionMinutos: 120, recursos: [resource] },
    { id: 'esmaltes-y-color', nombre: 'Esmaltes y color', descripcion: 'Explora combinaciones de color, superficies y aplicación de esmaltes. Experiencia de demostración.', precio: 75000, duracionMinutos: 120, recursos: [resource] }
  ],
  politica: { diasSemana: [0, 2, 3, 4, 5, 6], horas: ['10:00', '14:00', '17:00'], minPersonas: 1, maxPersonas: 4, capacidad: 8, capacidadCompartida: false }
};
export function getBookingConfig(): BookingConfig {
  const appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) throw new Error('APP_ORIGIN is required');
  return { namespace: 'booking', appOrigin, vercelUrl: process.env.VERCEL_URL || undefined, catalog: structuredClone(catalog) };
}
