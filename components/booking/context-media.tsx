'use client';
import { VerifiedBookingMedia } from '@/lib/client/booking/presentation';
import type { Resource } from '@/lib/client/booking/types';

export function ContextMedia({ resource, variant, onReady, onDispose, className = '' }: { resource: Resource; variant: 'hero' | 'compact' | 'ritual'; onReady?: (resource: Resource, ready: boolean) => void; onDispose?: (resource: Resource) => void; className?: string }) {
  const frame = variant === 'compact' ? 'h-[72px] w-[112px] shrink-0 sm:h-24 sm:w-36' : variant === 'hero' ? 'aspect-[4/3] w-full md:aspect-[16/10]' : 'aspect-[4/3] w-full';
  return <VerifiedBookingMedia resource={resource} containerClassName={`${frame} relative bg-[var(--brand-background)] ${className}`}
    className={`block h-full w-full object-center ${variant === 'ritual' ? 'object-contain' : 'object-cover'}`}
    onReady={(actual, ready) => { if (actual) onReady?.(actual, ready); }} onDispose={actual => { if (actual) onDispose?.(actual); }}
    renderPending={<span className="flex h-full items-center justify-center p-2 text-center text-xs" role="status">Chargement de la photo…</span>}
    renderError={({ retry }) => <div role="alert" className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center text-xs text-[var(--brand-text)]"><span>Foto no disponible.</span><button type="button" onClick={retry} className="min-h-11 px-2 text-sm font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">Reintentar foto</button></div>} />;
}
