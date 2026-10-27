import { Test, TestingModule } from '@nestjs/testing';
import { MedsShapeController } from './meds-shape.controller';
import { MedsShapeService } from './meds-shape.service';

describe('MedsShapeController', () => {
  let controller: MedsShapeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsShapeController],
      providers: [
        { provide: MedsShapeService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MedsShapeController>(MedsShapeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
