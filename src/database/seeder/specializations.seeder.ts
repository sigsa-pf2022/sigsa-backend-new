import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { ProfessionalSpecialization } from '../../professionals/entities/professional-specialization.entity';

export default class SpecializationsSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(ProfessionalSpecialization);
    const specializations = [
      {
        name: 'Alergia e inmunologia pediatrica',
      },
      {
        name: 'Alergia e inmunologia',
      },
      {
        name: 'Anatomia patologica',
      },
      {
        name: 'Anestesiologia',
      },
      {
        name: 'Anestesiologia general y hemodinamia',
      },
      {
        name: 'Cardiologia',
      },
      {
        name: 'Cardiologo infantil',
      },
      {
        name: 'Cirugia cardiovascular pediatrica',
      },
      {
        name: 'Cirugia cardiovascular',
      },
      {
        name: 'Cirugia de cabeza y cuello',
      },
      {
        name: 'Cirugia infantil',
      },
      {
        name: 'Cirugia plastica y reparadora',
      },
      {
        name: 'Cirugia toracica',
      },
      {
        name: 'Cirugia vascular periferica',
      },
      {
        name: 'Clinica medica',
      },
      {
        name: 'Coloproctologia',
      },
      {
        name: 'Dermatologia pediatrica',
      },
      {
        name: 'Dermatologia',
      },
      {
        name: 'Diagnostico por imagenes',
      },
      {
        name: 'Electro fisiologia cardiaca',
      },
      {
        name: 'Emergentologia',
      },
      {
        name: 'Endocrinologia',
      },
      {
        name: 'Endocrinologo infantil',
      },
      {
        name: 'Farmacologia clinica',
      },
      {
        name: 'Fisiatria',
      },
      {
        name: 'Gastroenterologia',
      },
      {
        name: 'Gastroenterologo infantil',
      },
      {
        name: 'Genetica medica',
      },
      {
        name: 'Geriatria',
      },
      {
        name: 'Ginecologia',
      },
      {
        name: 'Hematologia',
      },
      {
        name: 'Hemato-oncologia pediatrica',
      },
      {
        name: 'Hemoterapia e inmunohematologia',
      },
      {
        name: 'Hepatologia pediatrica',
      },
      {
        name: 'Hepatologia',
      },
      {
        name: 'Infectologia',
      },
      {
        name: 'Infectologo infantil',
      },
      {
        name: 'Medicina del deporte',
      },
      {
        name: 'Medicina del trabajo',
      },
      {
        name: 'Medicina general',
      },
      {
        name: 'Medicina legal',
      },
      {
        name: 'Medicina nuclear',
      },
      {
        name: 'Medicina paliativa',
      },
      {
        name: 'Nefrología',
      },
      {
        name: 'Nefrologo infantil',
      },
      {
        name: 'Neonatología',
      },
      {
        name: 'Neonatologo infantil',
      },
      {
        name: 'Neumonología',
      },
      {
        name: 'Neumonologo infantil',
      },
      {
        name: 'Neurocirugía',
      },
      {
        name: 'Neurología',
      },
      {
        name: 'Neurologo infantil',
      },
      {
        name: 'Nutrición',
      },
      {
        name: 'Obstetricia',
      },
      {
        name: 'Oftalmología',
      },
      {
        name: 'Oncología',
      },
      {
        name: 'Ortopedia y traumatología infantil',
      },
      {
        name: 'Ortopedia y traumatología',
      },
      {
        name: 'Otorrinolaringología',
      },
      {
        name: 'Pediatría',
      },
      {
        name: 'Psiquiatría infanto juvenil',
      },
      {
        name: 'Psiquiatría',
      },
      {
        name: 'Radioterapia',
      },
      {
        name: 'Reumatología',
      },
      {
        name: 'Reumatologo infantil',
      },
      {
        name: 'Terapia intensiva',
      },
      {
        name: 'Terapista intensivo infantil',
      },
      {
        name: 'Tocoginecología',
      },
      {
        name: 'Toxicología',
      },
      {
        name: 'Urología',
      },
    ];
    for (const specialization of specializations) {
      const newSpecialization = repository.create({
        name: specialization.name,
      });
      await repository.save(newSpecialization);
    }
  }
}
