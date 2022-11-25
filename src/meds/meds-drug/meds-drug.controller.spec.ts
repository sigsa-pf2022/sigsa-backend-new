import { Test, TestingModule } from '@nestjs/testing';
import { MedsDrugController } from './meds-drug.controller';

describe('MedsDrugController', () => {
  let controller: MedsDrugController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsDrugController],
    }).compile();

    controller = module.get<MedsDrugController>(MedsDrugController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
