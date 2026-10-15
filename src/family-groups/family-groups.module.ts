import { Module } from '@nestjs/common';
import { FamilyGroupsService } from './family-groups.service';
import { FamilyGroupsController } from './family-groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dependent } from '../family-groups/entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';
import { UsersModule } from '../users/users.module';
import { PatientProfessional } from '../professionals/entities/patient-professional.entity';
import { ProfessionalUser } from '../professionals/entities/professional-user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GroupEventsModule } from '../group-events/group-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dependent,
      FamilyGroup,
      PatientProfessional,
      ProfessionalUser,
    ]),
    UsersModule,
    NotificationsModule,
    GroupEventsModule,
  ],
  providers: [FamilyGroupsService],
  controllers: [FamilyGroupsController],
  exports: [FamilyGroupsService],
})
export class FamilyGroupsModule {}
