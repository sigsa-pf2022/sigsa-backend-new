import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventType } from './entities/event-type.entity';
import { NotificationEvent } from './entities/notification-event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEvent, EventType])],
  controllers: [ EventsController],
  providers: [EventsService],
})
export class EventsModule {}
