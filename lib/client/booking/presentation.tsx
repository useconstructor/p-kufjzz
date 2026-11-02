'use client';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefCallback, type RefObject } from 'react';

/** Structural shape of the immutable canonical Resource; no catalog/business facts live here. */
export type BookingPresentationResource = { id: string; version: number; url: string; sha256: string; alt: string; width?: number; height?: number };

function visibleEnabled(node: HTMLElement): boolean {
  if (!node.isConnected || node.closest('[inert],[aria-disabled="true"]') || node.matches(':disabled') || ('disabled' in node && Boolean(node.disabled))) return false;
  if (node.getClientRects().length === 0) return false;
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
  }
  return true;
}

/** Revealing the author's actual step is separate from requesting focus on its actual mounted field. */
export function useMountedBookingFocus() {
  const nodes = useRef(new Map<string, HTMLElement>());
  const callbacks = useRef(new Map<string, RefCallback<HTMLElement>>());
  const pending = useRef<{ key: string; nonce: number } | null>(null);
  const nonce = useRef(0);
  const mounted = useRef(false);
  const [, commitRequest] = useState(0);

  const attempt = useCallback(() => {
    const request = pending.current;
    if (!mounted.current || !request) return;
    const node = nodes.current.get(request.key);
    if (!node || !visibleEnabled(node)) return;
    // No asynchronous closure may focus an obsolete target/request.
    if (pending.current !== request || nodes.current.get(request.key) !== node) return;
    node.focus();
    if (document.activeElement === node) pending.current = null;
  }, []);

  const targetRef = useCallback((key: string): RefCallback<HTMLElement> => {
    if (!key) throw new Error('An explicit actual focus target key is required.');
    let callback = callbacks.current.get(key);
    if (!callback) {
      callback = node => {
        const previous = nodes.current.get(key);
        if (node) {
          nodes.current.set(key, node);
          const request = pending.current;
          if (request?.key === key) {
            // A nested child can commit without rerendering the hook owner. Queue
            // one actual post-commit attempt, bound to this precise request/node.
            queueMicrotask(() => {
              if (mounted.current && pending.current === request && nodes.current.get(key) === node) attempt();
            });
          }
        }
        else {
          nodes.current.delete(key);
          if (previous && pending.current?.key === key) pending.current = null;
        }
      };
      callbacks.current.set(key, callback);
    }
    return callback;
  }, [attempt]);

  const requestFocus = useCallback((key: string) => {
    if (!key) throw new Error('An explicit actual focus target key is required.');
    const ticket = ++nonce.current;
    pending.current = { key, nonce: ticket };
    commitRequest(ticket); // A repeated request for the same field still creates a new commit.
    return ticket;
  }, []);
  const cancelFocus = useCallback(() => { pending.current = null; nonce.current++; }, []);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current = null; };
  }, []);
  // Also runs when the author mounts/reveals a conditional step after the request.
  useLayoutEffect(attempt);
  return { targetRef, requestFocus, cancelFocus };
}

export type BookingMediaFailure = { resource: BookingPresentationResource | undefined; error: Error; retry(): void };
export type VerifiedBookingMediaProps = {
  resource?: BookingPresentationResource;
  className?: string;
  containerClassName?: string;
  loading?: 'eager' | 'lazy';
  /** Caller owns controller/state changes; this primitive never imports/mutates a controller. */
  onReady?(resource: BookingPresentationResource | undefined, ready: boolean): void;
  /** Separate lifecycle invalidation; not another synthetic media-operation result. */
  onDispose?(resource: BookingPresentationResource | undefined): void;
  renderPending?: ReactNode;
  renderError(failure: BookingMediaFailure): ReactNode;
};
type MediaOperation = { token: number; resource?: BookingPresentationResource; abort: AbortController; url?: string; ready: boolean; disposed: boolean };

/** Actual fetched canonical bytes and actual displayed image are verified; no fallback replacement is supplied. */
export function VerifiedBookingMedia(props: VerifiedBookingMediaProps) {
  const { resource, className, containerClassName, loading = 'eager', renderPending, renderError } = props;
  const callbacks = useRef(props);
  callbacks.current = props;
  const current = useRef<MediaOperation | null>(null);
  const serial = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [view, setView] = useState<{ token: number; url?: string; error?: Error; resource?: BookingPresentationResource; ready: boolean }>({ token: 0, ready: false });
  const retry = useCallback(() => setRetryNonce(value => value + 1), []);
  const id = resource?.id, version = resource?.version, url = resource?.url, sha256 = resource?.sha256, width = resource?.width, height = resource?.height, alt = resource?.alt;

  useLayoutEffect(() => {
    const operation: MediaOperation = { token: ++serial.current, resource: resource ? { ...resource } : undefined, abort: new AbortController(), ready: false, disposed: false };
    current.current = operation;
    const live = () => current.current === operation && !operation.disposed && !operation.abort.signal.aborted;
    const fail = (failure: unknown) => {
      if (!live()) return;
      const error = failure instanceof Error ? failure : new Error(String(failure));
      setView({ token: operation.token, error, ready: false });
    };
    setView({ token: operation.token, ready: false });
    callbacks.current.onReady?.(operation.resource, false);
    void (async () => {
      try {
        if (!operation.resource || typeof id !== 'string' || !id || typeof alt !== 'string' || !alt.trim() || !Number.isSafeInteger(version) || Number(version) <= 0 || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[?#\\]|(?:^|\/)\.\.(?:\/|$)/.test(url) || typeof sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(sha256) || !Number.isSafeInteger(width) || Number(width) <= 0 || !Number.isSafeInteger(height) || Number(height) <= 0) throw new Error('A complete canonical same-origin resource with meaningful alt, actual hash and exact decoded dimensions is required.');
        const target = new URL(url, window.location.origin);
        if (target.origin !== window.location.origin) throw new Error('The canonical resource must be same-origin.');
        const response = await fetch(target.href, { credentials: 'same-origin', signal: operation.abort.signal, redirect: 'error' });
        if (!response.ok) throw new Error(`The canonical image request failed (${response.status}).`);
        const limit = 20 * 1024 * 1024;
        if (Number(response.headers.get('content-length')) > limit) throw new Error('The canonical image exceeds the media verification bound.');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('The canonical image body cannot be read.');
        const chunks: Uint8Array[] = []; let length = 0;
        try {
          while (true) {
            const part = await reader.read(); if (part.done) break;
            length += part.value.byteLength;
            if (length > limit) { await reader.cancel(); throw new Error('The canonical image exceeds the media verification bound.'); }
            chunks.push(part.value);
          }
        } finally { reader.releaseLock(); }
        if (!live()) return;
        if (!length) throw new Error('The canonical image returned no actual bytes.');
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (!live()) return;
        if (digest !== sha256.toLowerCase()) throw new Error('The actual image bytes differ from the canonical SHA-256.');
        const type = response.headers.get('content-type')?.split(';')[0] || '';
        if (!type.startsWith('image/')) throw new Error('The canonical response is not an image.');
        operation.url = URL.createObjectURL(new Blob([bytes], { type }));
        if (!live()) { URL.revokeObjectURL(operation.url); return; }
        setView({ token: operation.token, resource: operation.resource, url: operation.url, ready: false });
      } catch (error) { if (!operation.abort.signal.aborted) fail(error); }
    })();
    return () => {
      operation.disposed = true; operation.abort.abort();
      if (operation.url) URL.revokeObjectURL(operation.url);
      if (current.current === operation) current.current = null;
      callbacks.current.onDispose?.(operation.resource);
    };
    // Callback identities, readiness publications and freshly derived resource wrappers do not restart verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version, url, sha256, width, height, alt, retryNonce]);

  const decoded = async (image: HTMLImageElement, token: number) => {
    const operation = current.current;
    if (!operation || operation.token !== token || operation.disposed || operation.ready || !image.isConnected) return;
    try {
      await image.decode();
      if (current.current !== operation || operation.disposed || !image.isConnected || image.src !== operation.url) return;
      if (image.naturalWidth !== operation.resource?.width || image.naturalHeight !== operation.resource?.height || image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error('Actual decoded image dimensions differ from the canonical resource.');
      operation.ready = true;
      setView({ token, resource: operation.resource, url: operation.url, ready: true });
      callbacks.current.onReady?.(operation.resource, true);
    } catch (error) {
      if (current.current === operation && !operation.disposed) setView({ token, error: error instanceof Error ? error : new Error(String(error)), ready: false });
    }
  };
  return <div className={containerClassName} aria-busy={!view.ready && !view.error}>
    {view.error ? renderError({ resource, error: view.error, retry }) : view.url ? <img key={view.token} src={view.url} alt={view.resource!.alt} width={view.resource!.width} height={view.resource!.height}
      data-booking-resource-id={view.resource!.id} data-booking-resource-version={view.resource!.version}
      data-booking-resource-url={view.resource!.url} data-booking-resource-sha256={view.resource!.sha256}
      data-booking-resource-width={view.resource!.width} data-booking-resource-height={view.resource!.height}
      data-booking-resource-alt={view.resource!.alt} loading={loading} className={className}
      onLoad={event => { void decoded(event.currentTarget, view.token); }}
      onError={() => { const operation = current.current; if (operation?.token === view.token && !operation.disposed) setView({ token: view.token, error: new Error('The actual canonical image could not be decoded.'), ready: false }); }} /> : renderPending}
  </div>;
}

export type NativeBookingDialogOptions = { triggerRef?: RefObject<HTMLElement | null>; onClose?(returnValue: string): void };

/** Native modal behavior plus actual dynamic Tab boundaries; author supplies dialog content and visual design. */
export function useNativeBookingDialog(options: NativeBookingDialogOptions = {}) {
  const callbacks = useRef(options); callbacks.current = options;
  const node = useRef<HTMLDialogElement | null>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const detach = useRef<(() => void) | null>(null);
  const dialogRef = useCallback((dialog: HTMLDialogElement | null) => {
    detach.current?.(); detach.current = null; node.current = dialog;
    if (!dialog) return;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],area[href],summary,[tabindex],[contenteditable="true"],audio[controls],video[controls]')].filter(element => element.tabIndex >= 0 && visibleEnabled(element));
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog.open || !dialog.matches(':modal')) return;
      const active = document.activeElement;
      if (active instanceof Element && active.closest('dialog:modal') && !dialog.contains(active)) return;
      const controls = focusable(), first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(active) || active === dialog || (event.shiftKey ? active === first : active === last)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    };
    const closed = () => {
      const target = returnTarget.current; returnTarget.current = null;
      if (target && visibleEnabled(target)) target.focus();
      callbacks.current.onClose?.(dialog.returnValue);
    };
    document.addEventListener('keydown', keydown); dialog.addEventListener('close', closed);
    detach.current = () => { document.removeEventListener('keydown', keydown); dialog.removeEventListener('close', closed); };
  }, []);
  const open = useCallback(() => {
    const dialog = node.current;
    if (!dialog?.isConnected) throw new Error('The actual native dialog must be mounted before opening.');
    if (dialog.open) return;
    returnTarget.current = callbacks.current.triggerRef?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog.showModal(); // Native cancel/Escape and inert background stay native.
  }, []);
  const close = useCallback((returnValue = '') => { if (node.current?.open) node.current.close(returnValue); }, []);
  useLayoutEffect(() => {
    // Reattach after StrictMode's effect cleanup even when the real dialog ref stays mounted.
    if (node.current && !detach.current) dialogRef(node.current);
    return () => { detach.current?.(); detach.current = null; returnTarget.current = null; };
  }, [dialogRef]);
  return { dialogRef, open, close };
}
