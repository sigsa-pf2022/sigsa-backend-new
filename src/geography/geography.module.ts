import { Module } from '@nestjs/common';
import { GeographyService } from './geography.service';
import { GeographyController } from './geography.controller';
import { Country } from './entities/country.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './entities/city.entity';
import { State } from './entities/state.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Country, City, State])],
  providers: [GeographyService],
  controllers: [GeographyController]
})
export class GeographyModule {}
