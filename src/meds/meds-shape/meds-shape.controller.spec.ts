import { Test, TestingModule } from '@nestjs/testing';
import { MedsShapeController } from './meds-shape.controller';

describe('MedsShapeController', () => {
  let controller: MedsShapeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsShapeController],
    }).compile();

    controller = module.get<MedsShapeController>(MedsShapeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
