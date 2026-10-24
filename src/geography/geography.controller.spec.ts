import { Test, TestingModule } from '@nestjs/testing';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';

describe('GeographyController', () => {
  let controller: GeographyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeographyController],
      providers: [
        { provide: GeographyService, useValue: {} },
      ],
    }).compile();

    controller = module.get<GeographyController>(GeographyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
