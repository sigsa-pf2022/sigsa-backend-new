import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedsShapeController } from './meds-shape.controller';
import { MedsShape } from './meds-shape.entity';
import { MedsShapeService } from './meds-shape.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedsShape])],
  providers: [MedsShapeService],
  exports: [MedsShapeService],
  controllers: [MedsShapeController],
})
export class MedsShapeModule {}
