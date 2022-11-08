import { DataSource } from "typeorm";
import { runSeeder, Seeder } from "typeorm-extension";
import CountrySeeder from "./country.seeder";

export class MainSeeder implements Seeder{
    async run(dataSource: DataSource): Promise<void> {
        await runSeeder(dataSource, CountrySeeder)
    }

}