import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { State } from './entities/state.entity';

@Injectable()
export class GeographyService {
  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @InjectRepository(State)
    private stateRepository: Repository<State>,
    @InjectRepository(City)
    private cityRepository: Repository<City>,
  ) {}

  getCountries() {
    return this.countryRepository.find();
  }
  getCountryById(id: number) {
    return this.countryRepository.findOne({ where: { id } });
  }
  getStateById(id: number) {
    return this.stateRepository.findOne({ where: { id } });
  }
  getStatesByCountry(country: Country) {
    return this.stateRepository.find({ where: { country } });
  }
  getCitiesByState(state: State) {
    return this.cityRepository.find({ where: { state } });
  }
}
