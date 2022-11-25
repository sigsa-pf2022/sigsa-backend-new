import { Test, TestingModule } from '@nestjs/testing';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';

describe('MedsMeasurementUnitService', () => {
  let service: MedsMeasurementUnitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsMeasurementUnitService],
    }).compile();

    service = module.get<MedsMeasurementUnitService>(MedsMeasurementUnitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
