import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedsMeasurementUnit])],
  providers: [MedsMeasurementUnitService],
  exports: [MedsMeasurementUnitService],
  controllers: [MedsMeasurementUnitModule],
})
export class MedsMeasurementUnitModule {}
