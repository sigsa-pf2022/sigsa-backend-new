import { State } from '../../geography/entities/state.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { HttpService } from '@nestjs/axios';
import { City } from '../../geography/entities/city.entity';

export default class CitiesSeeder implements Seeder {
  constructor(private readonly http?: HttpService) {
    this.http = new HttpService();
  }

  public async run(dataSource: DataSource): Promise<any> {
    const stateRepository = dataSource.getRepository(State);
    const cityRepository = dataSource.getRepository(City);
    const states: State[] = await stateRepository.find();
    for (const state of states) {
      const citiesData = await this.http.axiosRef.get(
        `https://apis.datos.gob.ar/georef/api/localidades?provincia=${state.id}&campos=nombre&orden=nombre&max=5000`,
      );
      
      for (const city of citiesData.data.localidades) {
        const newCity: City = cityRepository.create({
          name: city.nombre,
          state,
        });
        await cityRepository.save(newCity);
      }
    }
  }
}
