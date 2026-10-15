import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from 'src/appointments/appointment.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Notification } from 'src/notifications/entities/notification.entity';
import { NotificationRecipient } from 'src/notifications/entities/notification-recipient.entity';
import { User } from 'src/users/entities/user.entity';
import { GroupEventLog } from './entities/group-event-log.entity';
import { GroupEventsController } from './group-events.controller';
import { GroupEventsService } from './group-events.service';

/**
 * Acciones sobre eventos del grupo ("me hago cargo") e historial.
 *
 * Se inyectan los repositorios en vez de los servicios de meds-event,
 * appointments y family-groups: esos módulos ya importan NotificationsModule y
 * FamilyGroupsModule, y además necesitan importar éste para registrar en el
 * historial, así que depender de sus servicios armaría un ciclo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GroupEventLog,
      Notification,
      NotificationRecipient,
      MedEvent,
      Appointment,
      FamilyGroup,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [GroupEventsController],
  providers: [GroupEventsService],
  exports: [GroupEventsService],
})
export class GroupEventsModule {}
