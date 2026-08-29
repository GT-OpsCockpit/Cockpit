import { firstValueFrom } from 'rxjs';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

describe('RealtimeController', () => {
  let service: RealtimeService;
  let controller: RealtimeController;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new RealtimeService();
    controller = new RealtimeController(service);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('forwards trip-changed events to the stream', async () => {
    const next = firstValueFrom(controller.stream());
    service.emitTripChanged('R-CI1-26-1');

    await expect(next).resolves.toEqual({
      data: { type: 'trip-changed', ref: 'R-CI1-26-1' },
    });
  });

  it('emits a heartbeat on an idle stream so proxies do not drop it', () => {
    const received: unknown[] = [];
    const sub = controller.stream().subscribe((event) => received.push(event));

    jest.advanceTimersByTime(25_000);

    expect(received).toEqual([{ data: { type: 'heartbeat' } }]);
    sub.unsubscribe();
  });
});
