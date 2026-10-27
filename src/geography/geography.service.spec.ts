import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { State } from './entities/state.entity';
import { GeographyService } from './geography.service';

describe('GeographyService', () => {
  let service: GeographyService;
  let countries: MockRepository;
  let states: MockRepository;
  let cities: MockRepository;

  beforeEach(async () => {
    countries = mockRepository();
    states = mockRepository();
    cities = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeographyService,
        { provide: getRepositoryToken(Country), useValue: countries },
        { provide: getRepositoryToken(State), useValue: states },
        { provide: getRepositoryToken(City), useValue: cities },
      ],
    }).compile();

    service = module.get<GeographyService>(GeographyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('países, país y provincia por id', async () => {
    await service.getCountries();
    expect(countries.find).toHaveBeenCalled();
    await service.getCountryById(1);
    expect(countries.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    await service.getStateById(2);
    expect(states.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  it('provincias de un país y ciudades de una provincia, por nombre', async () => {
    await service.getStatesByCountry({ id: 1 } as Country);
    expect(states.find).toHaveBeenCalledWith({ where: { country: { id: 1 } }, order: { name: 'ASC' } });
    await service.getCitiesByState({ id: 2 } as State);
    expect(cities.find).toHaveBeenCalledWith({ where: { state: { id: 2 } }, order: { name: 'ASC' } });
  });
});
