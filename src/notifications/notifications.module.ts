import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { NotificationsService } from './notifications.service';
import { NotificationDeviceToken } from './entities/notification-device-token.entity';
import { NotificationsPushService } from './push/notifications-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './scheduler/notification-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationRecipient, NotificationDeviceToken])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsPushService, NotificationSchedulerService],
  exports: [NotificationsService, NotificationsPushService],
})
export class NotificationsModule {}
