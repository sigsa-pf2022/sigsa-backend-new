import { Test, TestingModule } from '@nestjs/testing';
import { MedsMeasurementUnitController } from './meds-measurement-unit.controller';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';

describe('MedsMeasurementUnitController', () => {
  let controller: MedsMeasurementUnitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsMeasurementUnitController],
      providers: [
        { provide: MedsMeasurementUnitService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MedsMeasurementUnitController>(MedsMeasurementUnitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
