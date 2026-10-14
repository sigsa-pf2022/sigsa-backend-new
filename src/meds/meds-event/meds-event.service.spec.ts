import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ADHERENCE_GRACE_HOURS,
  computeAdherence,
  MedsEventService,
} from './meds-event.service';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { MedEvent } from './med-event.entity';
import { Meds } from '../meds/meds.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { GroupEventsService } from 'src/group-events/group-events.service';

describe('MedsEventService', () => {
  let service: MedsEventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsEventService,
        { provide: getRepositoryToken(MedEvent), useValue: {} },
        { provide: getRepositoryToken(Meds), useValue: {} },
        { provide: FamilyGroupsService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: GroupEventsService, useValue: {} },
      ],
    }).compile();

    service = module.get<MedsEventService>(MedsEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('computeAdherence', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it('cuenta confirmadas como tomadas y discarded como omitidas', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CONFIRMED, date: hoursAgo(10) },
        { status: EventStatus.CONFIRMED, date: hoursAgo(5) },
        { status: EventStatus.DISCARDED, date: hoursAgo(3) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 2, omitted: 1, pending: 0, pct: 67 });
  });

  it('da por omitida una toma abierta recién pasadas las 2 h de gracia', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CREATED, date: hoursAgo(ADHERENCE_GRACE_HOURS + 0.1) },
        { status: EventStatus.SENDED, date: hoursAgo(3) },
        { status: EventStatus.CREATED, date: hoursAgo(ADHERENCE_GRACE_HOURS - 0.1) },
        { status: EventStatus.SENDED, date: hoursAgo(1) },
        { status: EventStatus.CREATED, date: hoursAgo(-5) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 0, omitted: 2, pending: 3, pct: 0 });
  });

  it('ignora las canceladas', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CANCELED, date: hoursAgo(10) },
        { status: EventStatus.CANCELED, date: hoursAgo(-10) },
        { status: EventStatus.CONFIRMED, date: hoursAgo(4) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 1, omitted: 0, pending: 0, pct: 100 });
  });

  it('devuelve pct null cuando no hay nada que medir', () => {
    expect(computeAdherence([], now)).toEqual({ taken: 0, omitted: 0, pending: 0, pct: null });
    expect(
      computeAdherence(
        [
          { status: EventStatus.CREATED, date: hoursAgo(-1) },
          { status: EventStatus.CANCELED, date: hoursAgo(20) },
        ],
        now,
      ),
    ).toEqual({ taken: 0, omitted: 0, pending: 1, pct: null });
  });

  it('acepta fechas como string (vienen así del JSON)', () => {
    const result = computeAdherence(
      [{ status: EventStatus.CREATED, date: hoursAgo(24).toISOString() }],
      now,
    );
    expect(result.omitted).toBe(1);
  });
});
