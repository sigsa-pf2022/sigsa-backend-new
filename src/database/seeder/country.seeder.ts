import { Country } from '../../geography/entities/country.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

export default class CountrySeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(Country);
    const newCountry = repository.create({
      name: 'Argentina',
    });
    await repository.save(newCountry);
  }
}
