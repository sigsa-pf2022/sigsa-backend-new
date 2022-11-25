import { Test, TestingModule } from '@nestjs/testing';
import { MedsMeasurementUnit } from './meds-measurement-unit.controller';

describe('MedsMeasurementUnit', () => {
  let controller: MedsMeasurementUnit;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsMeasurementUnit],
    }).compile();

    controller = module.get<MedsMeasurementUnit>(MedsMeasurementUnit);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
