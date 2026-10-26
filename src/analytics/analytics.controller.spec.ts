import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: Record<string, jest.Mock>;
  const methods = [
    'getOverview',
    'getEventsByPeriod',
    'getTopSpecializations',
    'getTopMeds',
    'getFamilyGroupsDistribution',
    'getPatientsLinkStatus',
    'getCareCoordination',
  ];

  beforeEach(async () => {
    service = Object.fromEntries(methods.map((m) => [m, jest.fn(async () => ({ ok: m }))]));
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    }).compile();
    controller = module.get(AnalyticsController);
  });

  it.each(methods)('%s delega el rango interpretado en hora local, con el día final inclusive', async (method) => {
    await expect((controller as any)[method]('2026-09-01', '2026-09-08')).resolves.toEqual({ ok: method });
    const [from, to] = service[method].mock.calls[0];
    expect(from).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 8, 8, 23, 59, 59, 999));
  });

  it('events-by-month es un alias de events-by-period', async () => {
    await controller.getEventsByMonth('2026-09-01', '2026-09-08');
    expect(service.getEventsByPeriod).toHaveBeenCalledTimes(1);
  });

  it('sin fechas usa los últimos 30 días', async () => {
    const before = Date.now();
    await controller.getOverview();
    const [from, to] = service.getOverview.mock.calls[0];
    expect(to.getTime()).toBeGreaterThanOrEqual(before);
    expect(Math.round((to.getTime() - from.getTime()) / 86400000)).toBe(30);
  });

  it('acepta fechas con hora (ISO completo)', async () => {
    await controller.getTopMeds('2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z');
    const [from, to] = service.getTopMeds.mock.calls[0];
    expect(from.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(to.toISOString()).toBe('2026-09-02T10:00:00.000Z');
  });

  it.each([
    [['basura', undefined], 'Invalid "from" date'],
    [[undefined, 'basura'], 'Invalid "to" date'],
    [['2026-09-10', '2026-09-01'], '"from" must be earlier than "to"'],
    [['2020-01-01', '2026-01-01'], 'Range too large (max 730 days)'],
  ])('rechaza rangos inválidos %p', (args, message) => {
    expect(() => controller.getOverview(...(args as [string, string]))).toThrow(new BadRequestException(message));
    expect(service.getOverview).not.toHaveBeenCalled();
  });

  it('propaga los errores del servicio', async () => {
    service.getCareCoordination.mockRejectedValue(new Error('db'));
    await expect(controller.getCareCoordination('2026-09-01', '2026-09-02')).rejects.toThrow('db');
  });
});
