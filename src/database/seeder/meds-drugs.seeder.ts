import { MedsDrug } from '../../meds/meds-drug/meds-drug.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

export default class MedsDrugsSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(MedsDrug);
    const drugs = [
      {
        name: 'Mesalazina',
      },
      {
        name: 'Amlodipina',
      },
      {
        name: 'Diltiazem',
      },
      {
        name: 'Ceftriaxona',
      },
      {
        name: 'Aciclovir',
      },
      {
        name: 'Allopurinol',
      },
      {
        name: 'Amiodarona',
      },
      {
        name: 'Amoxicilina',
      },
      {
        name: 'Atenolol',
      },
      {
        name: 'Benznidazol',
      },
      {
        name: 'Betametasona',
      },
      {
        name: 'Budesonide',
      },
      {
        name: 'Carbamazepina',
      },
      {
        name: 'Cefalexina',
      },
      {
        name: 'Clotrimazol',
      },
      {
        name: 'Cotrimoxazol',
      },
      {
        name: 'Dexametasona',
      },
      {
        name: 'Difenhidramina',
      },
      {
        name: 'Digoxina',
      },
      {
        name: 'Doxiciclina',
      },
      {
        name: 'Enalapril',
      },
      {
        name: 'Eritromicina',
      },
      {
        name: 'Estreptomicina',
      },
      {
        name: 'Etambutol',
      },
      {
        name: 'Fenitoina',
      },
      {
        name: 'Fluconazol',
      },
      {
        name: 'Fluoruro de sodio',
      },
      {
        name: 'Furazolidona',
      },
      {
        name: 'Glibenclamida',
      },
      {
        name: 'Ibuprofeno',
      },
      {
        name: 'Isoniazida',
      },
      {
        name: 'Levonorgestrel',
      },
    ];
    for (const drug of drugs) {
      const newDrug = repository.create({
        name: drug.name,
      });
      await repository.save(newDrug);
    }
  }
}
