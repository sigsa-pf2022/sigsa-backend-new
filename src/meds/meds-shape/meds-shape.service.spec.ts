import { Test, TestingModule } from '@nestjs/testing';
import { MedsShapeService } from './meds-shape.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MedsShape } from './meds-shape.entity';

describe('MedsShapeService', () => {
  let service: MedsShapeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsShapeService,
        { provide: getRepositoryToken(MedsShape), useValue: {} },
      ],
    }).compile();

    service = module.get<MedsShapeService>(MedsShapeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
