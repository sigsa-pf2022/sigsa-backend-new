import './src/bootstrap/crypto.polyfill';
import { config } from './src/config/env.config';
import { MainSeeder } from './src/database/seeder/main.seeder';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: config.db.host,
  port: 5432,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  entities: [`${__dirname}/**/*.entity.{ts,js}`],
  seeds: [MainSeeder],
};

export const AppDataSource = new DataSource(options);
