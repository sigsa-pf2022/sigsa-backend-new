import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationRecipientStatus } from './enums/notification-recipient-status.enum';

interface CreateAppointmentNotificationParams {
  appointmentId: number;
  groupId: number | null;
  scheduledFor: Date;
  leadMinutes: number;
  memberUserIds: number[]; // todos los integrantes del grupo a notificar
  payload?: any;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
  ) {}

  /**
   * Crea (si no existe) una notificación grupal para un turno y todos sus destinatarios.
   * Es idempotente respecto (type, referenceId, groupId)
   */
  async createForAppointmentGroup(params: CreateAppointmentNotificationParams) {
    const { appointmentId, groupId, scheduledFor, leadMinutes, memberUserIds, payload } = params;

    // Verificar si ya existe
    let notification = await this.notificationRepo.findOne({
      where: { type: NotificationType.APPOINTMENT, referenceId: appointmentId, groupId: groupId || null },
      relations: ['recipients'],
    });

    if (!notification) {
      notification = this.notificationRepo.create({
        type: NotificationType.APPOINTMENT,
        referenceId: appointmentId,
        groupId: groupId || null,
        scheduledFor,
        leadMinutes,
        payload: payload || null,
        status: NotificationStatus.CREATED,
      });
      notification = await this.notificationRepo.save(notification);
    }

    // Asegurar recipients (idempotente)
    const existingRecipientUserIds = new Set((notification.recipients || []).map(r => r.userId));
    const newRecipients = memberUserIds
      .filter(uid => !existingRecipientUserIds.has(uid))
      .map(uid => this.recipientRepo.create({
        notificationId: notification.id,
        userId: uid,
        status: NotificationRecipientStatus.PENDING,
        action: null,
        deliveredAt: null,
        respondedAt: null,
      }));

    if (newRecipients.length) {
      await this.recipientRepo.save(newRecipients);
      // refrescar
      notification = await this.notificationRepo.findOne({
        where: { id: notification.id },
        relations: ['recipients'],
      });
    }

    return notification;
  }
}
