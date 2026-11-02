import { createClient } from '@libsql/client';
import { createBookingHandlers } from '../../../lib/server/booking-engine';
import { getBookingConfig } from '../../../lib/server/booking-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let handlers: ReturnType<typeof createBookingHandlers> | undefined;

async function dispatch(request: Request): Promise<Response> {
  try {
    if (!handlers) {
      const url = process.env.TURSO_DATABASE_URL;
      const authToken = process.env.TURSO_AUTH_TOKEN;
      if (!url || !authToken) throw new Error('Booking database is not configured');
      const config = getBookingConfig();
      handlers = createBookingHandlers({ db: createClient({ url, authToken }), config });
    }
    return await handlers.handle(request);
  } catch {
    return Response.json({ ok: false, error: { code: 'SERVICIO_NO_DISPONIBLE', message: 'No pudimos completar la solicitud. Conserva tus datos e intenta de nuevo.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
