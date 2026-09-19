import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationRecipientStatus } from './enums/notification-recipient-status.enum';

interface CreateNotificationParams {
  referenceId: number;
  type: NotificationType;
  groupId: number | null;
  scheduledFor: Date;
  leadMinutes: number;
  memberUserIds: number[];
  payload?: any;
}

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

  private async createNotification(params: CreateNotificationParams) {
    const { referenceId, type, groupId, scheduledFor, leadMinutes, memberUserIds, payload } = params;

    let notification = await this.notificationRepo.findOne({
      where: { type, referenceId, groupId: groupId || null },
      relations: ['recipients'],
    });

    if (!notification) {
      notification = this.notificationRepo.create({
        type,
        referenceId,
        groupId: groupId || null,
        scheduledFor,
        leadMinutes,
        payload: payload || null,
        status: NotificationStatus.CREATED,
      });
      notification = await this.notificationRepo.save(notification);
    }

    const existingIds = new Set((notification.recipients || []).map(r => r.userId));
    const newRecipients = memberUserIds
      .filter(uid => !existingIds.has(uid))
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
      notification = await this.notificationRepo.findOne({
        where: { id: notification.id },
        relations: ['recipients'],
      });
    }

    return notification;
  }

  async createForMedEventGroup(params: {
    medEventId: number;
    groupId: number | null;
    scheduledFor: Date;
    memberUserIds: number[];
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.medEventId,
      type: NotificationType.MEDICATION,
      groupId: params.groupId,
      scheduledFor: params.scheduledFor,
      // ▼▼▼ DEMO — REVERTIR DESPUÉS ▼▼▼
      // El scheduler dispara cuando `scheduledFor - leadMinutes` ya pasó. Con un
      // lead de un año esa resta siempre cae en el pasado, así que el push sale
      // en el primer barrido del cron (dentro del minuto) sin importar para
      // cuándo sea el recordatorio: se crea en vivo y suena al toque, sin tener
      // que agendarlo dentro de una ventana de 5 minutos.
      //
      // Para volver atrás: borrar este bloque y descomentar la línea de abajo.
      // leadMinutes: 5,
      leadMinutes: 60 * 24 * 365,
      // ▲▲▲ DEMO — REVERTIR DESPUÉS ▲▲▲
      memberUserIds: params.memberUserIds,
      payload: params.payload,
    });
  }

  /**
   * Crea (si no existe) una notificación grupal para un turno y todos sus destinatarios.
   * Es idempotente respecto (type, referenceId, groupId)
   */
  async createForAppointmentGroup(params: CreateAppointmentNotificationParams) {
    return this.createNotification({
      referenceId: params.appointmentId,
      type: NotificationType.APPOINTMENT,
      groupId: params.groupId,
      scheduledFor: params.scheduledFor,
      leadMinutes: params.leadMinutes,
      memberUserIds: params.memberUserIds,
      payload: params.payload,
    });
  }

  /**
   * Cancela las notificaciones de eventos que ya no van a ocurrir (una toma
   * cancelada, un tratamiento cortado). Sin esto el scheduler las seguiría
   * despachando aunque el evento esté cancelado.
   */
  async cancelForReferences(type: NotificationType, referenceIds: number[]) {
    if (!referenceIds?.length) return { canceled: 0 };

    const notifications = await this.notificationRepo.find({
      where: { type, referenceId: In(referenceIds) },
      relations: ['recipients'],
    });
    if (!notifications.length) return { canceled: 0 };

    const pendingRecipientIds = notifications
      .flatMap(n => n.recipients || [])
      .filter(r => r.status === NotificationRecipientStatus.PENDING)
      .map(r => r.id);

    if (pendingRecipientIds.length) {
      await this.recipientRepo.update(pendingRecipientIds, {
        status: NotificationRecipientStatus.CANCELED,
      });
    }

    await this.notificationRepo.update(
      { id: In(notifications.map(n => n.id)) },
      { status: NotificationStatus.CANCELED },
    );

    return { canceled: notifications.length };
  }

  /**
   * Borra las notificaciones de un evento que dejó de existir.
   *
   * Cancelar alcanza mientras la fila del evento sobreviva, pero en un borrado
   * real no: `notifications.referenceId` es un entero suelto sin foreign key, y
   * el scheduler despacha leyendo sólo esta tabla y su payload cacheado. Una
   * notificación que sobreviva al evento manda un push de algo inexistente,
   * cuyo deep link cae en una pantalla rota.
   *
   * Se borran las filas en vez de marcarlas porque hay un índice único
   * `(type, referenceId, groupId)`: dejarlas canceladas bloquearía volver a
   * crear el mismo evento.
   *
   * Cubre también `EVENT_TAKEN_CHARGE`, que apunta al mismo `referenceId` y que
   * hoy queda huérfano incluso al cancelar.
   */
  async deleteForReferences(types: NotificationType[], referenceIds: number[]) {
    if (!referenceIds?.length || !types?.length) return { deleted: 0 };

    const notifications = await this.notificationRepo.find({
      where: { type: In(types), referenceId: In(referenceIds) },
      select: { id: true },
    });
    if (!notifications.length) return { deleted: 0 };

    const ids = notifications.map((n) => n.id);
    // Los recipients tienen onDelete CASCADE hacia notifications, pero se
    // borran explícitamente para no depender de eso.
    await this.recipientRepo.delete({ notificationId: In(ids) });
    await this.notificationRepo.delete({ id: In(ids) });

    return { deleted: ids.length };
  }

  /**
   * Avisa al resto del grupo que un integrante se hizo cargo de un evento.
   * Es inmediata (leadMinutes 0), igual que los avisos de vinculación.
   */
  async createForEventTakenCharge(params: {
    referenceId: number;
    groupId: number | null;
    memberUserIds: number[];
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.referenceId,
      type: NotificationType.EVENT_TAKEN_CHARGE,
      groupId: params.groupId,
      scheduledFor: new Date(),
      leadMinutes: 0,
      memberUserIds: params.memberUserIds,
      payload: params.payload,
    });
  }

  /**
   * Avisa al resto que un integrante no puede ocuparse. Inmediata, igual que la
   * de "se hizo cargo", pero el evento queda abierto: es coordinación, no cierre.
   */
  async createForEventDeclined(params: {
    referenceId: number;
    groupId: number | null;
    memberUserIds: number[];
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.referenceId,
      type: NotificationType.EVENT_DECLINED,
      groupId: params.groupId,
      scheduledFor: new Date(),
      leadMinutes: 0,
      memberUserIds: params.memberUserIds,
      payload: params.payload,
    });
  }

  async createForProfessionalLinkRequest(params: {
    patientProfessionalId: number;
    memberUserIds: number[];
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.patientProfessionalId,
      type: NotificationType.PROFESSIONAL_LINK_REQUEST,
      groupId: null,
      scheduledFor: new Date(),
      leadMinutes: 0,
      memberUserIds: params.memberUserIds,
      payload: params.payload,
    });
  }

  /** Avisa al paciente que un profesional se vinculó con él. */
  async createForProfessionalLinked(params: {
    patientProfessionalId: number;
    patientUserId: number;
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.patientProfessionalId,
      type: NotificationType.PROFESSIONAL_LINKED,
      groupId: null,
      scheduledFor: new Date(),
      leadMinutes: 0,
      memberUserIds: [params.patientUserId],
      payload: params.payload,
    });
  }

  async createForProfessionalLinkAccepted(params: {
    patientProfessionalId: number;
    professionalUserId: number;
    payload?: any;
  }) {
    return this.createNotification({
      referenceId: params.patientProfessionalId,
      type: NotificationType.PROFESSIONAL_LINK_ACCEPTED,
      groupId: null,
      scheduledFor: new Date(),
      leadMinutes: 0,
      memberUserIds: [params.professionalUserId],
      payload: params.payload,
    });
  }
}
