import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('delivers emitted trip-changed events to subscribers', () => {
    const service = new RealtimeService();
    const received: unknown[] = [];
    const sub = service.events$.subscribe((event) => received.push(event));

    service.emitTripChanged('R-CI1-26-1');

    expect(received).toEqual([{ type: 'trip-changed', ref: 'R-CI1-26-1' }]);
    sub.unsubscribe();
  });
});
