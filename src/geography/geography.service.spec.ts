import { Test, TestingModule } from '@nestjs/testing';
import { GeographyService } from './geography.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { State } from './entities/state.entity';
import { City } from './entities/city.entity';

describe('GeographyService', () => {
  let service: GeographyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeographyService,
        { provide: getRepositoryToken(Country), useValue: {} },
        { provide: getRepositoryToken(State), useValue: {} },
        { provide: getRepositoryToken(City), useValue: {} },
      ],
    }).compile();

    service = module.get<GeographyService>(GeographyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
