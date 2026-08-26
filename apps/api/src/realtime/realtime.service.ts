import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface TripChangedEvent {
  type: 'trip-changed';
  ref: string;
}

/**
 * In-process event bus for the SSE gateway. Replaces the legacy's 5s
 * dispatcher polling: mutating trip endpoints emit here, the SSE stream
 * forwards to connected clients as an invalidation signal (the REST contract
 * for reading trips is unchanged — SSE only tells the frontend when to refetch).
 */
@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<TripChangedEvent>();
  readonly events$ = this.subject.asObservable();

  emitTripChanged(ref: string): void {
    this.subject.next({ type: 'trip-changed', ref });
  }
}
