import { MedsType } from '../../meds/meds-type/meds-type.entity';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

export default class MedsTypesSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(MedsType);
    const types = [
      {
        name: 'Analgésico',
        description:
          'Indicados para aliviar el dolor ocasionado por lesiones, golpes o heridas',
      },
      {
        name: 'Antiinflamatorio',
        description:
          'Tienen como objetivo aliviar el dolor ocasionado por un proceso inflamatorio',
      },
      {
        name: 'Antipirético',
        description:
          'Disminuyen la fiebre, pero además tienen propiedades analgésicas',
      },
      {
        name: 'Laxante',
        description:
          'Se utilizan para aliviar el estreñimiento ocasional o el producido como efecto secundario de otros tratamientos farmacológicos',
      },
      {
        name: 'Antidiarreico',
        description:
          'Se emplean para reducir el numero y consistencia de las deposiciones en los procesos diarreicos',
      },
      {
        name: 'Antiinfeccioso',
        description:
          'Se clasifican en función del agente causante de la infección: antibióticos, antifúngicos o antivirales',
      },
      {
        name: 'Antitusivo',
        description:
          'Se utiliza tratar la tos seca irritativa, no productiva. Actúan sobre el sistema nervioso central o periférico para suprimir el reflejo de la tos',
      },
      {
        name: 'Mucolítico',
        description:
          'Tiene como objetivo fluidificar y facilitar la expulsión del moco, mejorando la respiración',
      },
      {
        name: 'Antiácido',
        description:
          'Se emplean para disminuir la acidez y las secreciones gástricas',
      },
      {
        name: 'Antialérgico',
        description:
          'Alivian los efectos negativos de la alergia, así como de las reacciones de hipersensibilidad',
      },
    ];
    for (const type of types) {
      const newType = repository.create({
        name: type.name,
        description: type.description,
      });
      await repository.save(newType);
    }
  }
}
