import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from 'src/appointments/appointments.module';
import { UsersModule } from 'src/users/users.module';
import { EventType } from './entities/event-type.entity';
import { NotificationEvent } from './entities/notification-event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEvent, EventType]), AppointmentsModule, UsersModule],
  controllers: [ EventsController],
  providers: [EventsService],
})
export class EventsModule {}
