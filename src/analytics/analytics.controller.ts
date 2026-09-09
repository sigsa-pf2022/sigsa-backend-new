import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

const MAX_RANGE_DAYS = 730;
const DEFAULT_RANGE_DAYS = 30;

/**
 * Interpreta un "YYYY-MM-DD" en hora local.
 *
 * `new Date('2026-09-08')` lo parsea como medianoche UTC, y el `setHours` que
 * venía después se aplica en hora local: en UTC-3 el rango terminaba el 7 a las
 * 23:59, así que el día que el usuario elegía como tope quedaba afuera y lo que
 * pasaba hoy no aparecía en los gráficos.
 */
function parseYmdLocal(value: string, endOfDay: boolean): Date {
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  // Default: last 30 days, inclusive end-of-day today.
  let to = now;
  let from = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86400000);

  if (toStr) {
    // Las fechas sin hora se toman como fin del día local, inclusive.
    const parsed = DATE_ONLY.test(toStr) ? parseYmdLocal(toStr, true) : new Date(toStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }
    to = parsed;
  }

  if (fromStr) {
    const parsed = DATE_ONLY.test(fromStr) ? parseYmdLocal(fromStr, false) : new Date(fromStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    from = parsed;
  }

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException('"from" must be earlier than "to"');
  }
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Range too large (max ${MAX_RANGE_DAYS} days)`);
  }

  return { from, to };
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getOverview(from, to);
  }

  @Get('events-by-period')
  getEventsByPeriod(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getEventsByPeriod(from, to);
  }

  // Backwards-compat alias for the old endpoint name.
  @Get('events-by-month')
  getEventsByMonth(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    return this.getEventsByPeriod(fromStr, toStr);
  }

  @Get('top-specializations')
  getTopSpecializations(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getTopSpecializations(from, to);
  }

  @Get('family-groups-distribution')
  getFamilyGroupsDistribution(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getFamilyGroupsDistribution(from, to);
  }

  @Get('patients-link-status')
  getPatientsLinkStatus(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getPatientsLinkStatus(from, to);
  }

  /** Cuánto se reparte el grupo el cuidado del dependiente ("Me hago cargo"). */
  @Get('care-coordination')
  getCareCoordination(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const { from, to } = parseRange(fromStr, toStr);
    return this.analyticsService.getCareCoordination(from, to);
  }
}
