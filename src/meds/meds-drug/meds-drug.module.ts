import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsDrugController } from './meds-drug.controller';
import { MedsDrug } from './meds-drug.entity';
import { MedsDrugService } from './meds-drug.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedsDrug])],
  providers: [MedsDrugService],
  exports: [MedsDrugService],
  controllers: [MedsDrugController],
})
export class MedsDrugModule {}
