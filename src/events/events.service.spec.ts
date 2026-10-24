import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: AppointmentsService, useValue: {} },
        { provide: MedsEventService, useValue: {} },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
