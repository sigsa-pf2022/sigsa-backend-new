import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationRecipient } from '../entities/notification-recipient.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationRecipientStatus } from '../enums/notification-recipient-status.enum';
import { NotificationsPushService } from '../push/notifications-push.service';
import { titleCase } from '../utils/title-case';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  /** Evita que dos barridos se pisen y manden la misma push dos veces. */
  private dispatching = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    private readonly pushService: NotificationsPushService,
  ) {}

  /**
   * Corre cada 5 segundos: toma notificaciones CREATED cuya ventana (scheduledFor - leadMinutes) ya pasó.
   * Envía push a recipients PENDING y marca delivered.
   *
   * ▼▼▼ DEMO — REVERTIR DESPUÉS ▼▼▼
   * Cada minuto, lo que se creaba ya dentro de la ventana esperaba hasta el
   * próximo minuto en punto (hasta 60 s). Con 5 s llega casi al toque.
   * Para volver atrás: @Cron(CronExpression.EVERY_MINUTE).
   * ▲▲▲ DEMO — REVERTIR DESPUÉS ▲▲▲
   *
   * Si un barrido tarda más que el intervalo (FCM lento), el siguiente se
   * saltea: los dos verían a los mismos recipients PENDING y duplicarían la push.
   */
  @Cron('*/5 * * * * *')
  async dispatchDueNotifications() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      await this.dispatchBatch();
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchBatch() {
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
    const dep = notification.payload?.dependentName
      ? ` de ${titleCase(notification.payload.dependentName)}`
      : '';
    const baseData = this.buildData(notification);

    if (notification.type === 'professional_link_request') {
      const professional = titleCase(notification.payload?.professionalName) || 'Un profesional';
      return {
        title: `Solicitud de vinculación${dep}`,
        body: `${professional} solicita vincularse como profesional.`,
        data: baseData,
      };
    }

    if (notification.type === 'professional_link_accepted') {
      return {
        title: `Vinculación aceptada${dep}`,
        body: notification.payload?.message ?? 'Tu solicitud de vinculación fue aceptada.',
        data: baseData,
      };
    }

    if (notification.type === 'professional_linked') {
      const professional = titleCase(notification.payload?.professionalName) || 'Un profesional';
      return {
        title: 'Nuevo profesional vinculado',
        // Se dice explícitamente qué acceso implica: es el dato que importa.
        body: `${professional} te agregó como paciente y puede ver tus documentos.`,
        data: baseData,
      };
    }

    if (notification.type === 'professional_note') {
      const professional = titleCase(notification.payload?.professionalName) || 'tu profesional';
      const forWhom = notification.payload?.dependentName
        ? `Para ${titleCase(notification.payload.dependentName)}: `
        : '';
      return {
        title: `Nueva indicación de Dr/a ${professional}`,
        body: `${forWhom}${notification.payload?.excerpt || 'Tocá para verla.'}`,
        data: baseData,
      };
    }

    if (notification.type === 'event_taken_charge') {
      const actor = titleCase(notification.payload?.actorName) || 'Un integrante';
      const what =
        notification.payload?.originalType === 'appointment'
          ? `del turno${dep}`
          : `del medicamento${dep}`;
      return {
        title: `${actor} se hizo cargo`,
        body: `Se va a ocupar ${what}.`,
        data: baseData,
      };
    }

    if (notification.type === 'event_declined') {
      const actor = titleCase(notification.payload?.actorName) || 'Un integrante';
      const what =
        notification.payload?.originalType === 'appointment'
          ? `del turno${dep}`
          : `del medicamento${dep}`;
      return {
        title: `${actor} no puede`,
        // Se dice explícitamente que sigue pendiente: es el punto del aviso.
        body: `No va a poder ocuparse ${what}. Sigue sin resolver.`,
        data: baseData,
      };
    }

    // Turno propio (sin grupo): no hay dependiente que nombrar, así que el
    // título lleva al profesional. Sin esto decía sólo "Turno". 'Profesional'
    // es el relleno que pone appointments.service cuando no hay ninguno.
    const professionalName = notification.payload?.professionalName;
    if (
      notification.type === 'appointment' &&
      notification.groupId == null &&
      professionalName &&
      professionalName !== 'Profesional'
    ) {
      return {
        title: `Turno con ${titleCase(professionalName)}`,
        body: notification.payload?.description || 'Recordatorio de turno',
        data: baseData,
      };
    }

    const titleBase = notification.type === 'appointment' ? 'Turno' : 'Medicamento';
    const title = `${titleBase}${dep}`;
    // El nombre del medicamento se deja tal cual: lleva unidades ("400mg").
    const body =
      notification.payload?.description ||
      titleCase(notification.payload?.professionalName) ||
      notification.payload?.medName ||
      'Recordatorio';
    return {
      title,
      body,
      data: baseData,
    };
  }

  /**
   * FCM exige que todos los valores de `data` sean strings.
   * `actionable` le dice al front si tiene que ofrecer "Me hago cargo":
   * sólo tiene sentido en eventos de un dependiente, es decir con grupo.
   * `selfAppointment` marca el turno propio, sin grupo: ahí el front ofrece
   * "Confirmar" / "Cancelar" en lugar de "Me hago cargo".
   */
  private buildData(notification: Notification): Record<string, string> {
    const isGroupEvent =
      notification.groupId != null &&
      (notification.type === 'appointment' || notification.type === 'medication');

    const data: Record<string, string> = {
      notificationId: String(notification.id),
      type: String(notification.type),
      referenceId: String(notification.referenceId),
      actionable: String(isGroupEvent),
      selfAppointment: String(notification.type === 'appointment' && notification.groupId == null),
    };
    if (notification.groupId != null) {
      data.groupId = String(notification.groupId);
    }
    if (notification.payload?.dependentId != null) {
      data.dependentId = String(notification.payload.dependentId);
    }
    if (notification.payload?.dependentName) {
      data.dependentName = titleCase(notification.payload.dependentName);
    }
    // El aviso de "alguien se hizo cargo" apunta al turno o medicamento
    // original, pero su propio `type` es event_taken_charge. Sin esto el front
    // no sabe a qué vista abrir cuando se toca la notificación.
    if (notification.payload?.originalType) {
      data.originalType = String(notification.payload.originalType);
    }
    return data;
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
