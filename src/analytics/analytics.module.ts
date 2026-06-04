import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { NormalUser } from 'src/users/entities/normal-user.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { PatientProfessional } from 'src/professionals/entities/patient-professional.entity';
import { Appointment } from 'src/appointments/appointment.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { MedicalDocument } from 'src/documents/medical-document.entity';
import { ProfessionalSpecialization } from 'src/professionals/entities/professional-specialization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NormalUser,
      ProfessionalUser,
      FamilyGroup,
      Dependent,
      PatientProfessional,
      Appointment,
      MedEvent,
      MedicalDocument,
      ProfessionalSpecialization,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
