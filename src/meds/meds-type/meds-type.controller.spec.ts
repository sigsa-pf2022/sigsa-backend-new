import { Test, TestingModule } from '@nestjs/testing';
import { MedsTypeController } from './meds-type.controller';
import { MedsTypeService } from './meds-type.service';

describe('MedsTypeController', () => {
  let controller: MedsTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsTypeController],
      providers: [
        { provide: MedsTypeService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MedsTypeController>(MedsTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
