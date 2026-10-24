import { Test, TestingModule } from '@nestjs/testing';
import { MedsDrugService } from './meds-drug.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MedsDrug } from './meds-drug.entity';

describe('MedsDrugService', () => {
  let service: MedsDrugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsDrugService,
        { provide: getRepositoryToken(MedsDrug), useValue: {} },
      ],
    }).compile();

    service = module.get<MedsDrugService>(MedsDrugService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
