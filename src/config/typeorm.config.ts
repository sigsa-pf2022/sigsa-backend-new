import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import CountrySeeder from 'src/database/seeder/country.seeder';
import SpecializationsSeeder from 'src/database/seeder/specializations.seeder';
import StatesSeeder from 'src/database/seeder/states.seeder';
import { SeederOptions } from 'typeorm-extension';

export default class TypeOrmConfig {
  static getOrmConfig(configService: ConfigService): TypeOrmModuleOptions & SeederOptions {
    return {
      type: 'postgres',
      host: configService.get('DB_HOST'),
      port: Number(configService.get('DB_PORT')),
      username: configService.get('DB_USERNAME'),
      password: configService.get('DB_PASSWORD'),
      database: configService.get('DB_NAME') || 'sigsa_db',
      autoLoadEntities: true,
      seeds: [CountrySeeder, StatesSeeder, SpecializationsSeeder],
      synchronize: true,
      logging: false,
      // dropSchema: true,
    };
    // config para windows
    // const url = __dirname.split('\\');
    // url.pop()
    // const dir = url.join('\\');
    // database: 'sigsa_db',
    // entities: [dir + '/**/*.entity{.ts,.js}'],
  }
  
}

export const typeOrmConfigAsync: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => TypeOrmConfig.getOrmConfig(configService),
  inject: [ConfigService],
};
