import { Module } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { ClinicsController } from './clinics.controller';

@Module({
  providers: [ClinicsService],
  controllers: [ClinicsController]
})
export class ClinicsModule {}
