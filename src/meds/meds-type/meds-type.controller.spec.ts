import { Test, TestingModule } from '@nestjs/testing';
import { MedsTypeController } from './meds-type.controller';

describe('MedsTypeController', () => {
  let controller: MedsTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsTypeController],
    }).compile();

    controller = module.get<MedsTypeController>(MedsTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
