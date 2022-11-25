import { Test, TestingModule } from '@nestjs/testing';
import { MedsTypeService } from './meds-type.service';

describe('MedsTypeService', () => {
  let service: MedsTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsTypeService],
    }).compile();

    service = module.get<MedsTypeService>(MedsTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
