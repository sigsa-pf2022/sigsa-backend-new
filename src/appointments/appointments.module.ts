import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { UsersModule } from 'src/users/users.module';
import { ProfessionalsModule } from 'src/professionals/professionals.module';
import { FamilyGroupsModule } from 'src/family-groups/family-groups.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { GroupEventsModule } from 'src/group-events/group-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    ProfessionalsModule,
    UsersModule,
    FamilyGroupsModule,
    NotificationsModule,
    GroupEventsModule,
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
