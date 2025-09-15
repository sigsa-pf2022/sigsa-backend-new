import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from 'src/appointments/appointments.module';
import { UsersModule } from 'src/users/users.module';
import { EventType } from './entities/event-type.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { MedsEventModule } from '../meds/meds-event/meds-event.module';
import { FamilyGroupsModule } from 'src/family-groups/family-groups.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventType]), 
    AppointmentsModule, 
    UsersModule,
    MedsEventModule,
    FamilyGroupsModule
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
