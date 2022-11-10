import { State } from '../../geography/entities/state.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { HttpService } from '@nestjs/axios';
import { Country } from '../../geography/entities/country.entity';

export default class StatesSeeder implements Seeder {
  constructor(private readonly http?: HttpService) {
    this.http = new HttpService();
  }
  public async run(dataSource: DataSource): Promise<any> {
    const stateRepository = dataSource.getRepository(State);
    const countryRepository = dataSource.getRepository(Country);
    const stateData = await this.http.axiosRef.get(
      `https://apis.datos.gob.ar/georef/api/provincias`,
    );
    const country: Country = await countryRepository.findOneBy({
      name: 'Argentina',
    });
    for (const state of stateData.data.provincias) {
      const newState: State = stateRepository.create({
        id: state.id,
        name: state.nombre,
        country,
      });
      await stateRepository.save(newState);
    }
  }
}
