'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, Menu, X, RotateCcw, CircleAlert } from 'lucide-react';
import branding from '@/branding.json';
import type { Option, Resource } from '@/lib/client/booking/types';
import { VerifiedBookingMedia, useNativeBookingDialog } from '@/lib/client/booking/presentation';

const cx = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(' ');
const markSource = `data:image/svg+xml,${encodeURIComponent(branding.brandbook.markSvg)}`;

export function BrandLogo({ linked = true, className }: { linked?: boolean; className?: string }) {
  const content = <><img data-brand-logo src={branding.logoImageUrl || markSource} width={44} height={44} alt="" className="size-11 shrink-0" /><span className="font-heading text-[30px] leading-none font-bold tracking-[-.045em]">{branding.logoText}</span></>;
  return linked ? <Link href="/" aria-label={`${branding.logoText} — Inicio`} className={cx('inline-flex min-h-11 items-center gap-1.5 text-brand-primary', className)}>{content}</Link> : <span className={cx('inline-flex items-center gap-1.5 text-brand-primary', className)}>{content}</span>;
}

const navigation = [{ href: '/', label: 'Inicio' }, { href: '/talleres', label: 'Talleres' }, { href: '/mis-reservas', label: 'Mis reservas' }];

export function BrandShell({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useNativeBookingDialog({ triggerRef: menuTrigger, onClose: () => setMenuOpen(false) });
  useEffect(() => { menu.close(); }, [pathname, menu.close]);
  return <div className={cx('min-h-screen', className)}>
    <a href="#contenido" className="sr-only focus:not-sr-only focus:block focus:w-fit focus:bg-brand-primary focus:px-5 focus:py-3 focus:text-brand-background">Saltar al contenido</a>
    <header className="border-b border-brand-primary/25">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-5 px-5 md:h-20 md:px-8 xl:px-0">
        <BrandLogo />
        <span className="hidden text-sm text-brand-muted lg:block">Taller de cerámica · Laureles, Medellín</span>
        <nav aria-label="Navegación principal" className="hidden items-center gap-6 md:flex">
          {navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className="inline-flex min-h-11 items-center border-b-2 border-transparent text-base font-semibold hover:border-brand-primary aria-[current=page]:border-brand-primary">{item.label}</Link>)}
          <Link href="/reservar" className="brand-button">Reservar <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </nav>
        <div className="flex items-center gap-2 md:hidden"><Link href="/reservar" className="min-h-11 content-center px-2 text-sm font-semibold text-brand-primary">Reservar</Link><button ref={menuTrigger} type="button" aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="menu-principal" className="grid size-11 place-items-center text-brand-primary" onClick={() => { menu.open(); setMenuOpen(true); }}><Menu size={24} /></button></div>
      </div>
    </header>
    <dialog ref={menu.dialogRef} id="menu-principal" aria-labelledby="menu-title" className="m-auto w-[calc(100%-40px)] max-w-md border border-brand-primary bg-brand-background p-6 text-brand-text backdrop:bg-brand-text/40">
      <div className="mb-5 flex items-center justify-between"><h2 id="menu-title" className="font-heading text-3xl text-brand-primary">Tu vuelta empieza aquí.</h2><button autoFocus type="button" onClick={() => menu.close()} aria-label="Cerrar menú" className="grid size-11 shrink-0 place-items-center"><X size={24} /></button></div>
      <nav aria-label="Navegación móvil" className="flex flex-col">{[...navigation, { href: '/reservar', label: 'Reservar un taller' }].map(item => <Link key={item.href} href={item.href} onClick={() => menu.close()} aria-current={pathname === item.href ? 'page' : undefined} className="border-t border-brand-primary/25 py-4 text-xl font-semibold text-brand-primary">{item.label}</Link>)}</nav>
    </dialog>
    {children}
    <footer className="mt-8 border-t border-brand-primary/30 md:mt-16">
      <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 xl:px-0">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start"><div><BrandLogo /><p className="mt-2 text-sm text-brand-muted">Barro, torno y color.</p></div><nav aria-label="Enlaces del pie de página" className="flex flex-wrap gap-x-6 gap-y-2">{navigation.map(item => <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center text-base underline decoration-brand-primary/40 underline-offset-4">{item.label}</Link>)}<Link href="/#creditos" className="inline-flex min-h-11 items-center text-base underline decoration-brand-primary/40 underline-offset-4">Créditos fotográficos</Link></nav></div>
        <p data-demo-notice className="mt-6 max-w-3xl border-t border-brand-primary/20 pt-4 text-sm leading-5 text-brand-muted">Vuelta es un taller ficticio. Ubicación, experiencias y precios de ejemplo. Las reservas son de demostración; no se realizan pagos ni se envían mensajes.</p>
      </div>
    </footer>
  </div>;
}

export function BrandPage({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <main id="contenido" tabIndex={-1} className={cx('brand-page mx-auto max-w-[1280px] px-5 pt-5 md:px-8 md:pt-10 xl:px-0', className)}><header className="mb-5 md:mb-8"><h1 className="font-heading text-[32px] leading-[1.05] font-bold tracking-[-.035em] text-brand-primary md:text-5xl">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-base leading-6 text-brand-muted md:text-lg">{subtitle}</p>}</header>{children}</main>;
}

const steps = [{ key: 'opcion-turno', label: 'Taller y turno' }, { key: 'datos', label: 'Tus datos' }, { key: 'revision', label: 'Revisión' }];
export function BrandSteps({ current, className }: { current: string; className?: string }) {
  const active = steps.findIndex(step => step.key === current || step.label === current || (step.key === 'datos' && current === 'contacto'));
  return <nav aria-label="Pasos de tu reserva" className={cx('relative mb-4 border-b border-brand-primary/30', className)}><ol className="grid grid-cols-3">{steps.map((step, index) => <li key={step.key} aria-current={index === active ? 'step' : undefined} className={cx('py-2 text-[14px] leading-5 font-semibold', index === active ? 'text-brand-primary' : 'text-brand-muted')}>{step.label}</li>)}</ol>{active >= 0 && <span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] w-1/3 bg-brand-primary transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `translateX(${active * 100}%)` }} />}</nav>;
}

export function CraftStudy({ name, className }: { name: string; className?: string }) {
  const kind = /taza/i.test(name) ? 'cup' : /torno/i.test(name) ? 'wheel' : /esmalte|color/i.test(name) ? 'color' : null;
  if (!kind) return null;
  return <svg viewBox="0 0 180 120" fill="none" role="img" aria-label={`Estudio ilustrado: ${name}. Referencia de técnica, no resultado garantizado.`} className={cx('h-auto w-32 text-brand-primary', className)}>
    <path d="M12 103C-2 47 38 7 91 9C151 9 179 45 166 86" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'cup' ? <><path d="M43 39Q74 28 107 39L103 88Q76 103 47 88Z" fill="#C65D42" fillOpacity=".22" /><ellipse cx="75" cy="39" rx="32" ry="8" /><path d="M108 47C145 34 147 87 105 80M109 58C128 50 129 72 107 70M52 61L54 79M61 66L63 87" /><path d="M32 104Q85 112 136 100" opacity=".4" /></> : kind === 'wheel' ? <><ellipse cx="90" cy="95" rx="64" ry="12" /><path d="M57 48Q90 61 123 48L115 79Q91 91 65 79Z" fill="#C65D42" fillOpacity=".3" /><ellipse cx="90" cy="48" rx="33" ry="9" /><path d="M61 59Q90 71 120 59M64 70Q89 81 117 70M78 107V114M103 107V114M23 76Q13 61 27 48M24 48L27 57M27 48L18 49" /></> : <><path d="M38 29L78 24L85 72L45 78Z" fill="#254DA6" /><path d="M99 38L139 44L132 91L92 85Z" fill="#C65D42" /><path d="M58 79L97 76L100 108L61 111Z" fill="#F5F0E7" /><path d="M102 53L128 57M100 63L126 67M69 88L88 87M70 97L89 96" /><circle cx="57" cy="38" r="3" fill="#F5F0E7" stroke="none" /></>}
    </g>
  </svg>;
}

export function WorkshopEdge({ serviceName, status = 'neutral', children, action, className }: { serviceName?: string; status?: 'neutral' | 'pending' | 'warning' | 'confirmed' | 'cancelled'; children?: ReactNode; action?: ReactNode; className?: string }) {
  return <section data-workshop-edge data-status={status} className={cx('border-t-[3px] border-brand-primary bg-brand-primary/[.035] px-4 py-3 md:px-6 md:py-5', status === 'warning' && 'border-brand-accent', status === 'confirmed' && 'border-brand-success', className)}>{serviceName && <div className="mb-3 flex items-center justify-between gap-4"><h2 className="font-heading text-2xl font-semibold tracking-[-.035em] text-brand-primary md:text-3xl">{serviceName}</h2><CraftStudy name={serviceName} className="w-20 shrink-0 md:w-28" /></div>}{children}{action && <div className="mt-4 flex flex-wrap items-center gap-3">{action}</div>}</section>;
}

export function BrandNotice({ kind, title, children, action, className }: { kind: 'info' | 'warning' | 'error' | 'success'; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return <div role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'} className={cx('my-4 border-y border-current bg-brand-background px-4 py-3 text-base leading-6', kind === 'error' || kind === 'warning' ? 'border-brand-accent' : kind === 'success' ? 'border-brand-success' : 'border-brand-primary', className)}><p className="font-semibold">{title}</p>{children && <div className="mt-1 break-words">{children}</div>}{action && <div className="mt-3 flex flex-wrap gap-3">{action}</div>}</div>;
}

export function ContextMedia({ resource, variant, onReady, className }: { resource: Resource; variant: 'hero' | 'compact' | 'ritual'; onReady?: (resource: Resource, ready: boolean) => void; className?: string }) {
  return <VerifiedBookingMedia resource={resource} loading={variant === 'ritual' ? 'lazy' : 'eager'}
    containerClassName={cx('relative grid w-full place-items-center bg-brand-text/[.045]', variant === 'hero' ? 'aspect-[3/2] md:aspect-[2/1]' : variant === 'compact' ? 'h-[76px]' : 'aspect-[4/3]', className)}
    className="absolute inset-0 h-full w-full object-contain"
    onReady={(current, ready) => { if (current) onReady?.(current, ready); }}
    onDispose={current => { if (current) onReady?.(current, false); }}
    renderPending={<p className="px-3 py-2 text-sm text-brand-muted" role="status">Cargando fotografía…</p>}
    renderError={({ resource: failed, retry }) => <div role="alert" className={cx('relative z-10 flex w-full items-center justify-center gap-3 bg-brand-background/95 p-3 text-brand-text', variant !== 'compact' && 'flex-col text-center')}><CircleAlert size={20} className="shrink-0 text-brand-primary" aria-hidden="true" /><p className="min-w-0 text-sm leading-5">No pudimos mostrar {failed?.alt ? `la fotografía: ${failed.alt}` : 'esta fotografía'}.</p><button type="button" onClick={retry} className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-semibold text-brand-primary underline underline-offset-4"><RotateCcw size={16} aria-hidden="true" />Reintentar imagen</button></div>} />;
}

export function ServiceIndex({ options, selectedId, onSelect, disabled, className }: { options: readonly Option[]; selectedId: string | null; onSelect: (id: string) => void; disabled?: boolean; className?: string }) {
  const selectedIndex = options.findIndex(option => option.id === selectedId);
  return <div className={cx('relative', className)}><div role="group" aria-label="Elige una experiencia" className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}>{options.map(option => <button key={option.id} type="button" aria-pressed={selectedId === option.id} disabled={disabled} onClick={() => onSelect(option.id)} className="min-h-[72px] border-b border-current/30 px-2 pb-3 pt-2 text-left text-[15px] leading-5 font-semibold transition-colors duration-200 hover:bg-current/5 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none md:px-4 md:text-lg">{option.nombre}<span className="mt-1 block text-xs font-normal">{selectedId === option.id ? 'Seleccionado' : 'Elegir taller'}</span></button>)}</div>{selectedIndex >= 0 && <span data-selection-guide aria-hidden="true" className="pointer-events-none absolute bottom-[-3px] left-0 h-2 border-b-[3px] border-l-[3px] border-current rounded-bl-xl transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ width: `${100 / options.length}%`, transform: `translateX(${selectedIndex * 100}%)` } as CSSProperties} />}</div>;
}

export function SelectionGuide({ selectedId, className }: { selectedId: string | null; className?: string }) {
  return <span aria-hidden="true" data-selection-guide-for={selectedId || undefined} className={cx('inline-block h-7 w-9 shrink-0 rounded-bl-[20px] border-b-[3px] border-l-[3px] border-brand-primary transition-transform duration-200 motion-reduce:transition-none', selectedId ? 'translate-x-0' : '-translate-x-1', className)} />;
}
