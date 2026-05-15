import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalUser } from './entities/professional-user.entity';
import { UsersModule } from 'src/users/users.module';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { Professionals } from './entities/my-professional.entity';
import { PatientProfessional } from './entities/patient-professional.entity';
import { MailModule } from 'src/mail/mail.module';
import { DocumentsModule } from 'src/documents/documents.module';
import { FamilyGroupsModule } from 'src/family-groups/family-groups.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfessionalUser,
      ProfessionalSpecialization,
      Professionals,
      PatientProfessional,
    ]),
    UsersModule,
    MailModule,
    DocumentsModule,
    FamilyGroupsModule,
    NotificationsModule,
  ],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
  controllers: [ProfessionalsController],
})
export class ProfessionalsModule {}
