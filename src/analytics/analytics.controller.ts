import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

const MAX_RANGE_DAYS = 730;
const DEFAULT_RANGE_DAYS = 30;

function parseRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  // Default: last 30 days, inclusive end-of-day today.
  let to = now;
  let from = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86400000);

  if (toStr) {
    const parsed = new Date(toStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }
    // Treat date-only strings (YYYY-MM-DD) as end-of-day inclusive.
    if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      parsed.setHours(23, 59, 59, 999);
    }
    to = parsed;
  }

  if (fromStr) {
    const parsed = new Date(fromStr);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
      parsed.setHours(0, 0, 0, 0);
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
