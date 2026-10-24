import { Test, TestingModule } from '@nestjs/testing';
import { MedsDrugController } from './meds-drug.controller';
import { MedsDrugService } from './meds-drug.service';

describe('MedsDrugController', () => {
  let controller: MedsDrugController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsDrugController],
      providers: [
        { provide: MedsDrugService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MedsDrugController>(MedsDrugController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
