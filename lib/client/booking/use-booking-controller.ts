'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createBookingController, type BookingController } from './controller';

/** Pass a stable shared controller when several components render the same flow. */
export function useBookingController(provided?: BookingController) {
  const controller = useMemo(() => provided ?? createBookingController(), [provided]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => { void controller.start().catch(() => {}); return controller.detachLocationListeners; }, [controller]);
  return { state, controller };
}
