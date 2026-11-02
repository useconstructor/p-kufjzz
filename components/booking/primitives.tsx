'use client';

import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerifiedBookingMedia, useNativeBookingDialog } from '@/lib/client/booking/presentation';
import type { Option, Resource } from '@/lib/client/booking/types';
import { cn } from '@/lib/utils';

export const fieldClass = 'h-12 w-full rounded-none border border-[var(--brand-text)] bg-[var(--brand-background)] px-3 py-2 text-base text-[var(--brand-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-60';
export const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-none border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-base font-semibold text-[var(--brand-background)] transition-colors hover:bg-[var(--brand-text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-primary)] disabled:opacity-50 motion-reduce:transition-none';
export const textLinkClass = 'inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-primary)]';
export const Action = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }>(function Action({ className, secondary, children, ...props }, ref) {
  return <Button ref={ref} type="button" {...props} className={cn(actionClass, 'h-auto whitespace-normal', secondary && 'border-[var(--brand-text)] bg-transparent text-[var(--brand-text)] hover:bg-[var(--brand-surface)]', className)}>{children}</Button>;
});

export function PhotoCredit({ className }: { className?: string }) {
  return <p className={cn('text-xs leading-4 text-[var(--brand-muted)]', className)}>Manos en el torno, Egipto, 2024: <a className="underline underline-offset-2" href="https://commons.wikimedia.org/wiki/File:Hands_of_the_pottery_maker_in_Egypt_2024.jpg" target="_blank" rel="noreferrer">Violinistman</a> · <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Imagen completa, sin recorte. Fotografía representativa del trabajo en torno compartida entre talleres; no muestra esmaltado, instalaciones, clientes ni resultados de Vuelta.</p>;
}

export function ContextMedia({ resource, variant, onReady, className }: { resource: Resource; variant: 'hero' | 'compact' | 'ritual'; onReady?: (resource: Resource, ready: boolean) => void; className?: string }) {
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useNativeBookingDialog({ triggerRef: opener });
  const compact = variant === 'compact';
  const frame = compact ? 'h-[104px] w-full sm:h-[128px]' : variant === 'ritual' ? 'aspect-[4/3] w-full' : 'aspect-[4/3] w-full md:aspect-[16/10]';
  return <figure className={cn('grid min-w-0 grid-cols-1 grid-rows-[auto_auto_auto] items-start gap-y-1', className)}>
    <VerifiedBookingMedia resource={resource} containerClassName={cn('relative row-start-1 grid min-h-0 place-items-center bg-brand-text/[.045]', frame)} className="absolute inset-0 h-full w-full object-contain object-center"
      onReady={(current, ready) => { if (current) onReady?.(current, ready); }}
      onDispose={current => { if (current) onReady?.(current, false); }}
      renderPending={<span role="status" className="p-3 text-sm">Cargando fotografía…</span>}
      renderError={({ retry }) => <div role="alert" className="flex h-full w-full flex-col items-start justify-center gap-1 p-2 text-sm leading-4"><span>Fotografía no disponible.</span><button type="button" onClick={retry} className={cn(textLinkClass, 'text-sm')}><RefreshCw size={14} aria-hidden="true" /> Reintentar imagen</button></div>} />
    <button ref={opener} type="button" onClick={dialog.open} className={cn(textLinkClass, 'row-start-2 min-h-11 w-fit max-w-full gap-1 text-left text-xs leading-4')}><span>Ver fotografía<span className="inline-block whitespace-nowrap"> completa <ArrowRight className="inline-block" size={12} aria-hidden="true" /></span></span></button>
    {!compact && <PhotoCredit />}
    <dialog ref={dialog.dialogRef} aria-label="Fotografía completa de manos modelando barro en el torno" className="m-auto w-[min(92vw,960px)] max-w-none rounded-[var(--brand-radius)] border border-[var(--brand-text)] bg-[var(--brand-background)] p-4 text-[var(--brand-text)] backdrop:bg-black/65 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-[family-name:var(--brand-font-heading)] text-xl">Manos en el torno</h2><Action secondary onClick={() => dialog.close()} aria-label="Cerrar fotografía"><X size={18} aria-hidden="true" /></Action></div>
      <VerifiedBookingMedia resource={resource} containerClassName="grid h-[min(58vh,600px)] place-items-center" className="h-full w-full object-contain object-center" renderPending={<p role="status">Cargando fotografía…</p>} renderError={({ retry }) => <div role="alert"><p>No pudimos abrir la fotografía completa.</p><Action secondary onClick={retry}>Reintentar imagen</Action></div>} />
      <PhotoCredit className="mt-3" />
    </dialog>
  </figure>;
}

export function ServiceIndex({ options, selectedId, onSelect, disabled, className }: { options: readonly Option[]; selectedId: string | null; onSelect: (id: string) => void; disabled?: boolean; className?: string }) {
  return <div className={cn('divide-y divide-[var(--brand-muted)] border-y border-[var(--brand-text)]', className)}>{options.map(option => <button type="button" key={option.id} disabled={disabled} aria-pressed={selectedId === option.id} onClick={() => onSelect(option.id)} className={cn('flex min-h-16 w-full items-center justify-between gap-4 p-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]', selectedId === option.id && 'bg-[var(--brand-surface)]')}><span><strong className="font-[family-name:var(--brand-font-heading)] text-xl">{option.nombre}</strong><span className="block text-sm">{option.descripcion}</span></span><ArrowRight aria-hidden="true" size={20} /></button>)}</div>;
}

export function SelectionGuide({ selectedId, className }: { selectedId: string | null; className?: string }) {
  return <p className={cn('text-sm leading-5', className)}>{selectedId ? 'Elige fecha y turno. Después, cuéntanos quién viene.' : 'Elige Taller para consultar los turnos disponibles.'}</p>;
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-[family-name:var(--brand-font-heading)] text-2xl leading-tight sm:text-3xl">{children}</h2>;
}
