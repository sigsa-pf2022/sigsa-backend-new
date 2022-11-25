import { Test, TestingModule } from '@nestjs/testing';
import { MedsShapeService } from './meds-shape.service';

describe('MedsShapeService', () => {
  let service: MedsShapeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsShapeService],
    }).compile();

    service = module.get<MedsShapeService>(MedsShapeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
