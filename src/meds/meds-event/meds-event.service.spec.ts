import { Test, TestingModule } from '@nestjs/testing';
import { MedsEventService } from './meds-event.service';

describe('MedsEventService', () => {
  let service: MedsEventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsEventService],
    }).compile();

    service = module.get<MedsEventService>(MedsEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
