import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import CountrySeeder from 'src/database/seeder/country.seeder';
import { SeederOptions } from 'typeorm-extension';

export default class TypeOrmConfig {
  static getOrmConfig(configService: ConfigService): TypeOrmModuleOptions & SeederOptions {
    const url = __dirname.split('/');
    url.pop()
    const dir = url.join('/');
    return {
      type: 'mysql',
      host: configService.get('DB_HOST'),
      port: Number(configService.get('DB_PORT)')),
      username: configService.get('DB_USERNAME'),
      password: configService.get('DB_PASSWORD'),
      database: 'sigsa_db',
      entities: [dir + '/**/*.entity{.ts,.js}'],
      seeds: [CountrySeeder],
      synchronize: true,
      logging: true,
      // dropSchema: true,
    };
  }
}

export const typeOrmConfigAsync: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => TypeOrmConfig.getOrmConfig(configService),
  inject: [ConfigService],
};
