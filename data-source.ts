import { MainSeeder } from './src/database/seeder/main.seeder';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

console.log(__dirname)
const options: DataSourceOptions & SeederOptions = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'owner',
  password: "0wn3r",
  database: 'sigsa_db',
  entities: [`${__dirname}/**/*.entity.{ts,js}`],
  seeds: [MainSeeder],
};

export const AppDataSource = new DataSource(options);
