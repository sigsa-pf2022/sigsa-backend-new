import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsMeasurementUnitController } from './meds-measurement-unit.controller';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MedsMeasurementUnit])],
  providers: [MedsMeasurementUnitService],
  exports: [MedsMeasurementUnitService],
  controllers: [MedsMeasurementUnitController],
})
export class MedsMeasurementUnitModule {}
