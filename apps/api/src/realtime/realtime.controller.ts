import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { Public } from '../common/decorators/public.decorator';

// Proxies (and nginx's 60s proxy_read_timeout in front of this API) drop a
// connection that has been idle too long, and a dispatcher board can sit
// quiet for far longer than a minute at night. The heartbeat keeps the
// stream provably alive; clients ignore any payload that is not
// `trip-changed` (see apps/web/src/features/bookings/use-trip-events.ts).
const HEARTBEAT_MS = 25_000;

@Controller('events')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  // Public: the unauthenticated /driver/:ref and /track/:ref pages also
  // subscribe to this stream. The payload is just {type, ref} (see
  // realtime.service.ts) — no trip content — so broadcasting it to anyone
  // holding a ref link carries no data-leak risk.
  @Public()
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return merge(
      this.realtimeService.events$,
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'heartbeat' as const }))),
    ).pipe(map((event) => ({ data: event })));
  }
}
