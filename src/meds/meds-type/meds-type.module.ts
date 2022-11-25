import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsTypeController } from './meds-type.controller';
import { MedsType } from './meds-type.entity';
import { MedsTypeService } from './meds-type.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedsType])],
  providers: [MedsTypeService],
  exports: [MedsTypeService],
  controllers: [MedsTypeController],
})
export class MedsTypeModule {}
