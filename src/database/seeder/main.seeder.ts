import { DataSource } from "typeorm";
import { runSeeder, Seeder } from "typeorm-extension";
import CitiesSeeder from "./cities.seeder";
import CountrySeeder from "./country.seeder";
import SpecializationsSeeder from "./specializations.seeder";
import StatesSeeder from "./states.seeder";

export class MainSeeder implements Seeder{
    async run(dataSource: DataSource): Promise<void> {
        await runSeeder(dataSource, CountrySeeder)
        await runSeeder(dataSource, StatesSeeder)
        await runSeeder(dataSource, CitiesSeeder)
        await runSeeder(dataSource, SpecializationsSeeder)
    }

}