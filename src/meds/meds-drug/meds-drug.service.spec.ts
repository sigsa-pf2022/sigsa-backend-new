import { Test, TestingModule } from '@nestjs/testing';
import { MedsDrugService } from './meds-drug.service';

describe('MedsDrugService', () => {
  let service: MedsDrugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsDrugService],
    }).compile();

    service = module.get<MedsDrugService>(MedsDrugService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
