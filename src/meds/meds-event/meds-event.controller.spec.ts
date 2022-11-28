import { Test, TestingModule } from '@nestjs/testing';
import { MedsEventController } from './meds-event.controller';

describe('MedsEventController', () => {
  let controller: MedsEventController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsEventController],
    }).compile();

    controller = module.get<MedsEventController>(MedsEventController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
