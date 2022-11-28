import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsController } from './meds.controller';
import { Meds } from './meds.entity';
import { MedsService } from './meds.service';

@Module({
  imports: [TypeOrmModule.forFeature([Meds])],
  providers: [MedsService],
  exports: [MedsService],
  controllers: [MedsController],
})
export class MedsModule {}
