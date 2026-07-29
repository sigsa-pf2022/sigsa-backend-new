import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Appointment } from 'src/appointments/appointment.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { Notification } from 'src/notifications/entities/notification.entity';
import { NotificationRecipient } from 'src/notifications/entities/notification-recipient.entity';
import { NotificationRecipientAction } from 'src/notifications/enums/notification-recipient-action.enum';
import { NotificationRecipientStatus } from 'src/notifications/enums/notification-recipient-status.enum';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/users/entities/user.entity';
import { GroupEventLog } from './entities/group-event-log.entity';
import { GroupEventAction, GroupEventTargetType } from './enums/group-event-action.enum';

/** Qué tipo de notificación corresponde a qué evento. */
const TARGET_BY_NOTIFICATION_TYPE: Partial<Record<NotificationType, GroupEventTargetType>> = {
  [NotificationType.MEDICATION]: GroupEventTargetType.MED_EVENT,
  [NotificationType.APPOINTMENT]: GroupEventTargetType.APPOINTMENT,
};

@Injectable()
export class GroupEventsService {
  constructor(
    @InjectRepository(GroupEventLog)
    private readonly logRepo: Repository<GroupEventLog>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    @InjectRepository(MedEvent)
    private readonly medEventRepo: Repository<MedEvent>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(FamilyGroup)
    private readonly familyGroupRepo: Repository<FamilyGroup>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Registra una acción en el historial del grupo. Nunca tira: el historial es
   * un efecto secundario y no debe romper la operación que lo dispara.
   */
  async log(entry: {
    groupId: number;
    actorUserId?: number | null;
    action: GroupEventAction;
    targetType: GroupEventTargetType;
    targetId?: number | null;
    payload?: any;
  }) {
    try {
      if (!entry?.groupId) return null;
      return await this.logRepo.save(
        this.logRepo.create({
          groupId: entry.groupId,
          actorUserId: entry.actorUserId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          payload: entry.payload ?? null,
        }),
      );
    } catch (err) {
      console.error('Error registrando en el historial del grupo:', err?.message || err);
      return null;
    }
  }

  /**
   * Un integrante se hace cargo del evento del dependiente (o lo descarta).
   *
   * Sella al destinatario y al evento, deja de insistirle al resto y les avisa
   * quién se hizo cargo.
   */
  async respondToNotification(
    notificationId: number,
    userId: number,
    action: NotificationRecipientAction,
  ) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
      relations: ['recipients'],
    });
    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return this.respond(notification, userId, action);
  }

  /**
   * La misma acción pero entrando por el evento en vez de por la notificación:
   * es lo que usa el botón "Me hago cargo" dentro de la app, que conoce el
   * turno o el medicamento pero no la notificación que lo anunció.
   */
  async respondToEvent(
    targetType: GroupEventTargetType,
    targetId: number,
    userId: number,
    action: NotificationRecipientAction,
  ) {
    const type =
      targetType === GroupEventTargetType.MED_EVENT
        ? NotificationType.MEDICATION
        : NotificationType.APPOINTMENT;

    const notification = await this.notificationRepo.findOne({
      where: { type, referenceId: targetId },
      relations: ['recipients'],
    });
    if (!notification) {
      throw new NotFoundException('Este evento no tiene una notificación grupal');
    }
    return this.respond(notification, userId, action);
  }

  private async respond(
    notification: Notification,
    userId: number,
    action: NotificationRecipientAction,
  ) {
    const recipient = (notification.recipients || []).find((r) => r.userId === userId);
    if (!recipient) {
      throw new ForbiddenException('La notificación no es tuya');
    }

    const targetType = TARGET_BY_NOTIFICATION_TYPE[notification.type];
    if (!targetType) {
      throw new ConflictException('Esta notificación no admite acciones');
    }

    // Descartar es sólo para el que responde: no afecta al resto del grupo.
    if (action === NotificationRecipientAction.DISCARD) {
      await this.recipientRepo.update(recipient.id, {
        action,
        status: NotificationRecipientStatus.DISCARDED,
        respondedAt: new Date(),
      });
      return { status: 'discarded' };
    }

    const event = await this.findEvent(targetType, notification.referenceId);
    if (!event) {
      throw new NotFoundException('El evento ya no existe');
    }

    // Carrera entre dos integrantes: gana el primero.
    if (event.takenChargeByUserId) {
      const owner = await this.userRepo.findOne({ where: { id: event.takenChargeByUserId } });
      throw new ConflictException(
        owner
          ? `${owner.firstName} ${owner.lastName} ya se hizo cargo`
          : 'Otro integrante ya se hizo cargo',
      );
    }

    const now = new Date();
    const actor = await this.userRepo.findOne({ where: { id: userId } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'Alguien';

    await this.getRepo(targetType).update(event.id, {
      takenChargeByUserId: userId,
      takenChargeAt: now,
    } as any);

    await this.recipientRepo.update(recipient.id, {
      action,
      status: NotificationRecipientStatus.CONFIRMED,
      respondedAt: now,
    });

    // El resto ya no necesita el recordatorio: alguien lo tomó.
    const stillPending = (notification.recipients || [])
      .filter((r) => r.id !== recipient.id && r.status === NotificationRecipientStatus.PENDING)
      .map((r) => r.id);
    if (stillPending.length) {
      await this.recipientRepo.update(stillPending, {
        status: NotificationRecipientStatus.CANCELED,
      });
    }

    const otherMemberIds = (notification.recipients || [])
      .map((r) => r.userId)
      .filter((id) => id !== userId);

    await this.notifyGroup(notification, otherMemberIds, actorName);

    await this.log({
      groupId: notification.groupId,
      actorUserId: userId,
      action: GroupEventAction.EVENT_TAKEN_CHARGE,
      targetType,
      targetId: event.id,
      payload: {
        actorName,
        eventDate: event.date,
        ...(notification.payload || {}),
      },
    });

    return {
      status: 'taken_charge',
      takenChargeByUserId: userId,
      takenChargeByName: actorName,
      takenChargeAt: now,
    };
  }

  /** Avisa al resto del grupo que alguien se hizo cargo. */
  private async notifyGroup(notification: Notification, memberIds: number[], actorName: string) {
    if (!memberIds.length) return;
    try {
      await this.notificationsService.createForEventTakenCharge({
        referenceId: notification.referenceId,
        groupId: notification.groupId,
        memberUserIds: memberIds,
        payload: {
          ...(notification.payload || {}),
          actorName,
          originalType: notification.type,
        },
      });
    } catch (err) {
      console.error('Error avisando al grupo:', err?.message || err);
    }
  }

  private getRepo(targetType: GroupEventTargetType) {
    return targetType === GroupEventTargetType.MED_EVENT
      ? this.medEventRepo
      : this.appointmentRepo;
  }

  private async findEvent(targetType: GroupEventTargetType, id: number) {
    return this.getRepo(targetType).findOne({ where: { id } });
  }

  /** Historial del grupo, con el nombre del actor ya resuelto. */
  async getHistory(groupId: number, userId: number, limit = 50, offset = 0) {
    await this.assertMembership(groupId, userId);

    const [entries, total] = await this.logRepo.findAndCount({
      where: { groupId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    // Los actores se repiten mucho entre entradas (son los integrantes del
    // grupo), así que se resuelven de una sola vez. Sólo los campos que se
    // muestran: sin esto vendría también el hash de la contraseña.
    const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter(Boolean))];
    const actors = actorIds.length
      ? await this.userRepo.find({
          select: { id: true, firstName: true, lastName: true, photo: true },
          where: { id: In(actorIds) },
        })
      : [];
    const actorsById = new Map(actors.map((a) => [a.id, a]));

    return {
      total,
      entries: entries.map((entry) => {
        const actor = actorsById.get(entry.actorUserId);
        return {
          ...entry,
          actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
          actorPhoto: actor?.photo ?? null,
        };
      }),
    };
  }

  /** Sólo los integrantes del grupo pueden ver su historial. */
  async assertMembership(groupId: number, userId: number) {
    const group = await this.familyGroupRepo.findOne({
      where: { id: groupId },
      relations: { members: true, createdBy: true },
    });
    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }
    const isMember =
      group.createdBy?.id === userId || (group.members || []).some((m) => m?.id === userId);
    if (!isMember) {
      throw new ForbiddenException('No pertenecés a este grupo');
    }
    return group;
  }
}
