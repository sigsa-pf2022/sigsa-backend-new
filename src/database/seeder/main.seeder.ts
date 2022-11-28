import { DataSource } from "typeorm";
import { runSeeder, Seeder } from "typeorm-extension";
import CitiesSeeder from "./cities.seeder";
import CountrySeeder from "./country.seeder";
import MedsDrugsSeeder from "./meds-drugs.seeder";
import MedsTypesSeeder from "./meds-types.seeder";
import SpecializationsSeeder from "./specializations.seeder";
import StatesSeeder from "./states.seeder";

export class MainSeeder implements Seeder{
    async run(dataSource: DataSource): Promise<void> {
        await runSeeder(dataSource, CountrySeeder)
        await runSeeder(dataSource, StatesSeeder)
        await runSeeder(dataSource, MedsDrugsSeeder)
        await runSeeder(dataSource, MedsTypesSeeder)
        await runSeeder(dataSource, SpecializationsSeeder)
        // await runSeeder(dataSource, CitiesSeeder)
    }

}