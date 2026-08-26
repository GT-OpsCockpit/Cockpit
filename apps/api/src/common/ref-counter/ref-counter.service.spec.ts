import { RefCounterService } from './ref-counter.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RefCounterService', () => {
  it('returns the incremented value from the upsert', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ lastValue: 3 }]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const service = new RefCounterService(prisma);

    const value = await service.next('client:individual');

    expect(value).toBe(3);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('uses a distinct sequence per scope', async () => {
    const values: Record<string, number> = {};
    const prisma = {
      $queryRaw: jest.fn((strings: TemplateStringsArray, scope: string) => {
        values[scope] = (values[scope] ?? 0) + 1;
        return Promise.resolve([{ lastValue: values[scope] }]);
      }),
    } as unknown as PrismaService;
    const service = new RefCounterService(prisma);

    expect(await service.next('client:individual')).toBe(1);
    expect(await service.next('client:company')).toBe(1);
    expect(await service.next('client:individual')).toBe(2);
  });
});
