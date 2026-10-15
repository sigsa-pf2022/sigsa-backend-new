import { Module } from '@nestjs/common';
import { MedsEventService } from './meds-event.service';
import { MedsEventController } from './meds-event.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedEvent } from './med-event.entity';
import { Meds } from '../meds/meds.entity';
import { UsersModule } from 'src/users/users.module';
import { FamilyGroupsModule } from 'src/family-groups/family-groups.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { GroupEventsModule } from 'src/group-events/group-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedEvent, Meds]),
    UsersModule,
    FamilyGroupsModule,
    NotificationsModule,
    GroupEventsModule,
  ],
  controllers: [MedsEventController],
  providers: [MedsEventService],
  exports: [MedsEventService],
})
export class MedsEventModule {}
