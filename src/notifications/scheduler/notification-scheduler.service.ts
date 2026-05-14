import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationRecipient } from '../entities/notification-recipient.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationRecipientStatus } from '../enums/notification-recipient-status.enum';
import { NotificationsPushService } from '../push/notifications-push.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    private readonly pushService: NotificationsPushService,
  ) {}

  /**
   * Corre cada minuto: toma notificaciones CREATED cuya ventana (scheduledFor - leadMinutes) ya pasó.
   * Envía push a recipients PENDING y marca delivered.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueNotifications() {
    const now = Date.now();
    // Buscar un lote pequeño para no sobrecargar (p.ej. 50 por corrida)
    const candidates = await this.notificationRepo.find({
      where: { status: NotificationStatus.CREATED },
      relations: ['recipients'],
      take: 50,
      order: { scheduledFor: 'ASC' },
    });

    for (const notification of candidates) {
      const triggerTime = new Date(notification.scheduledFor).getTime() - notification.leadMinutes * 60000;
      if (triggerTime > now) continue; // todavía no toca

      const pendingRecipients = (notification.recipients || []).filter(r => r.status === NotificationRecipientStatus.PENDING);
      if (!pendingRecipients.length) {
        // Si ya no hay pendientes, mover a SENT si al menos uno delivered, o COMPLETED si todos respondieron
        await this.recomputeNotificationStatus(notification.id);
        continue;
      }

      // Enviar push
      const userIds = pendingRecipients.map(r => r.userId);
      const payload = this.buildPayload(notification);
      const { sent } = await this.pushService.sendToUsers(userIds, payload);
      if (sent) {
        // Marcar recipients delivered
        const deliveredIds = pendingRecipients.map(r => r.id);
        await this.recipientRepo.update(deliveredIds, { status: NotificationRecipientStatus.DELIVERED, deliveredAt: new Date() });
      }
      await this.recomputeNotificationStatus(notification.id);
    }
  }

  private buildPayload(notification: Notification) {
    const dep = notification.payload?.dependentName ? ` de ${notification.payload.dependentName}` : '';

    if (notification.type === 'professional_link_request') {
      const professional = notification.payload?.professionalName ?? 'Un profesional';
      return {
        title: `Solicitud de vinculación${dep}`,
        body: `${professional} solicita vincularse como profesional.`,
        data: { notificationId: String(notification.id), type: String(notification.type), referenceId: String(notification.referenceId) },
      };
    }

    if (notification.type === 'professional_link_accepted') {
      return {
        title: `Vinculación aceptada${dep}`,
        body: notification.payload?.message ?? 'Tu solicitud de vinculación fue aceptada.',
        data: { notificationId: String(notification.id), type: String(notification.type), referenceId: String(notification.referenceId) },
      };
    }

    const titleBase = notification.type === 'appointment' ? 'Turno' : 'Medicamento';
    const title = `${titleBase}${dep}`;
    const body = notification.payload?.description || notification.payload?.professionalName || notification.payload?.medName || 'Recordatorio';
    return {
      title,
      body,
      data: {
        notificationId: String(notification.id),
        type: String(notification.type),
        referenceId: String(notification.referenceId),
      },
    };
  }

  private async recomputeNotificationStatus(notificationId: number) {
    const notif = await this.notificationRepo.findOne({ where: { id: notificationId }, relations: ['recipients'] });
    if (!notif) return;
    const recipients = notif.recipients || [];
    if (!recipients.length) return; // nada que hacer

    const counts = {
      pending: 0,
      delivered: 0,
      responded: 0, // confirmed or discarded
      canceled: 0,
    };
    for (const r of recipients) {
      switch (r.status) {
        case NotificationRecipientStatus.PENDING: counts.pending++; break;
        case NotificationRecipientStatus.DELIVERED: counts.delivered++; break;
        case NotificationRecipientStatus.CONFIRMED:
        case NotificationRecipientStatus.DISCARDED: counts.responded++; break;
        case NotificationRecipientStatus.CANCELED: counts.canceled++; break;
      }
    }

    let newStatus: NotificationStatus | null = null;
    const total = recipients.length;
    if (counts.pending === 0 && counts.delivered > 0 && counts.responded === 0) {
      newStatus = NotificationStatus.SENT;
    }
    if (counts.pending === 0 && (counts.responded + counts.canceled) === total) {
      newStatus = NotificationStatus.COMPLETED;
    }
    if (counts.pending > 0 && counts.delivered > 0) {
      newStatus = NotificationStatus.PARTIALLY_SENT;
    }

    if (newStatus && newStatus !== notif.status) {
      notif.status = newStatus;
      await this.notificationRepo.save(notif);
    }
  }
}
