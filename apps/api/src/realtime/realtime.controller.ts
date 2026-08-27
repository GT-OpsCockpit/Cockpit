import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { Public } from '../common/decorators/public.decorator';

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
    return this.realtimeService.events$.pipe(map((event) => ({ data: event })));
  }
}
