import { Test, TestingModule } from '@nestjs/testing';
import { MedsService } from './meds.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Meds } from './meds.entity';

describe('MedsService', () => {
  let service: MedsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsService,
        { provide: getRepositoryToken(Meds), useValue: {} },
      ],
    }).compile();

    service = module.get<MedsService>(MedsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
