import { Test, TestingModule } from '@nestjs/testing';
import { MedsTypeService } from './meds-type.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MedsType } from './meds-type.entity';

describe('MedsTypeService', () => {
  let service: MedsTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsTypeService,
        { provide: getRepositoryToken(MedsType), useValue: {} },
      ],
    }).compile();

    service = module.get<MedsTypeService>(MedsTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
