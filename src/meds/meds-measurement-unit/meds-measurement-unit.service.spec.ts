import { Test, TestingModule } from '@nestjs/testing';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';

describe('MedsMeasurementUnitService', () => {
  let service: MedsMeasurementUnitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsMeasurementUnitService,
        { provide: getRepositoryToken(MedsMeasurementUnit), useValue: {} },
      ],
    }).compile();

    service = module.get<MedsMeasurementUnitService>(MedsMeasurementUnitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
