import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Appointment } from 'src/appointments/appointment.entity';
import { EventStatus } from 'src/events/entities/notification-event.entity';
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

/**
 * Cuántas entradas crudas se leen para armar el historial.
 *
 * Se agrupa en memoria sobre esta ventana, así que tiene que ser holgada: si se
 * cortara justo, un evento viejo aparecería con la mitad de sus movimientos.
 */
const HISTORY_ENTRY_WINDOW = 500;

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

    const event = await this.findEvent(targetType, notification.referenceId);
    if (!event) {
      throw new NotFoundException('El evento ya no existe');
    }

    // Mismo criterio que la UI (`isActionable` en el front): sobre un evento
    // vencido o cancelado no se responde. Vivía sólo en el cliente, así que una
    // notificación vieja alcanzaba para confirmar algo que ya había pasado —y
    // peor, para pisar un `canceled` y dejarlo `confirmed`.
    if (event.status === EventStatus.CANCELED) {
      throw new ConflictException('El evento fue cancelado');
    }
    if (new Date(event.date).getTime() < Date.now()) {
      throw new ConflictException('El evento ya pasó');
    }

    const now = new Date();
    const actor = await this.userRepo.findOne({ where: { id: userId } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'Alguien';
    const otherMemberIds = (notification.recipients || [])
      .map((r) => r.userId)
      .filter((id) => id !== userId);

    // "No puedo": no resuelve el evento, pero sí es información para el resto.
    // Antes sólo marcaba la fila del que respondía y ahí moría: nadie se
    // enteraba de que un integrante se había bajado.
    if (action === NotificationRecipientAction.DISCARD) {
      await this.recipientRepo.update(recipient.id, {
        action,
        status: NotificationRecipientStatus.DISCARDED,
        respondedAt: now,
      });

      await this.notifyGroupDeclined(notification, otherMemberIds, actorName);

      await this.log({
        groupId: notification.groupId,
        actorUserId: userId,
        action: GroupEventAction.EVENT_DECLINED,
        targetType,
        targetId: event.id,
        payload: {
          actorName,
          eventDate: event.date,
          ...(notification.payload || {}),
        },
      });

      return { status: 'discarded', declinedByName: actorName };
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

    // Hacerse cargo también confirma el evento. Antes eran dos ejes separados
    // —el status por un lado, quién se ocupa por el otro— y en la pantalla
    // convivían "Confirmar turno" y "Me hago cargo" como si fueran opciones
    // distintas. Se unificaron en la segunda: es la que además avisa al grupo y
    // queda en el historial, así que confirmar por separado no aportaba nada.
    //
    // Vale para turnos y para tomas de medicamento: `getRepo` resuelve los dos.
    await this.getRepo(targetType).update(event.id, {
      takenChargeByUserId: userId,
      takenChargeAt: now,
      status: EventStatus.CONFIRMED,
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

  /** Avisa al resto que un integrante no puede ocuparse. El evento sigue abierto. */
  private async notifyGroupDeclined(
    notification: Notification,
    memberIds: number[],
    actorName: string,
  ) {
    if (!memberIds.length) return;
    try {
      await this.notificationsService.createForEventDeclined({
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
      console.error('Error avisando al grupo que alguien no puede:', err?.message || err);
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

  /**
   * Historial del grupo, agrupado por evento.
   *
   * Antes era una lista cronológica plana y no se podía seguir la historia de un
   * turno: su creación, quién se hizo cargo y su cancelación quedaban salteadas
   * entre entradas de otros eventos. Ahora cada evento es un grupo con sus
   * movimientos adentro, ordenados del más viejo al más nuevo.
   *
   * Las entradas que no son de un evento —alguien se sumó al grupo, se vinculó
   * un profesional— no se agrupan: van sueltas en la misma línea de tiempo, como
   * grupos de una sola entrada. Agruparlas por `targetId` sería un error: ahí el
   * target es un userId, así que "agregó a Juan" y "sacó a Juan" colapsarían.
   *
   * Se agrupa acá y no en el cliente porque el front pide una ventana de N
   * entradas: agrupar sobre esa ventana partiría grupos al medio, mostrando la
   * cancelación de un turno sin la fila de quién lo creó.
   */
  async getHistory(groupId: number, userId: number, limit = 50, offset = 0) {
    await this.assertMembership(groupId, userId);

    // Se traen las entradas crudas y se agrupa en memoria. `id` desempata:
    // crear y hacerse cargo suelen caer en el mismo segundo y sin esto salían
    // en orden arbitrario.
    const entries = await this.logRepo.find({
      where: { groupId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: HISTORY_ENTRY_WINDOW,
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

    const seriesByDoseId = await this.resolveSeriesIds(entries);

    const grupos = new Map<string, any>();
    for (const entry of entries) {
      const actor = actorsById.get(entry.actorUserId);
      const resuelta = {
        ...entry,
        actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
        actorPhoto: actor?.photo ?? null,
      };

      const groupKey = this.historyGroupKey(entry, seriesByDoseId);
      let grupo = grupos.get(groupKey);
      if (!grupo) {
        grupo = {
          groupKey,
          targetType: entry.targetType,
          targetId: entry.targetId,
          // Las de tipo MEMBER se dibujan como fila simple, sin desplegable.
          grouped: entry.targetType !== GroupEventTargetType.MEMBER,
          lastAt: entry.createdAt,
          entries: [],
        };
        grupos.set(groupKey, grupo);
      }
      grupo.entries.push(resuelta);
    }

    const groups = [...grupos.values()].map((g) => {
      // Vienen del más nuevo al más viejo; adentro del grupo se lee al revés.
      g.entries.reverse();
      const creacion = g.entries.find(
        (e: any) => e.action === GroupEventAction.EVENT_CREATED,
      );
      return {
        ...g,
        // El título sale de la creación cuando existe: en un tratamiento las
        // otras entradas guardan la fecha de otra toma.
        title: (creacion ?? g.entries[0])?.payload ?? null,
        lastEntry: g.entries[g.entries.length - 1],
      };
    });

    const page = groups.slice(offset, offset + Math.min(limit, 100));
    return { total: groups.length, groups: page };
  }

  /**
   * Clave de agrupamiento de una entrada del historial.
   *
   * Para un tratamiento, las tres acciones apuntan a tomas distintas de la misma
   * serie —crear guarda la toma 1, hacerse cargo la toma concreta, y cancelar la
   * primera toma futura—, así que agrupar por `targetId` lo partiría en tres.
   * Con el `seriesId` resuelto quedan juntas, y funciona sobre los datos que ya
   * están guardados sin migrar nada.
   */
  private historyGroupKey(entry: GroupEventLog, seriesByDoseId: Map<number, string>) {
    if (entry.targetType === GroupEventTargetType.MEMBER) {
      // Sin agrupar: cada entrada es su propia fila.
      return `entry:${entry.id}`;
    }
    if (entry.targetType === GroupEventTargetType.MED_EVENT) {
      const serie = seriesByDoseId.get(entry.targetId);
      if (serie) return `med_event:serie:${serie}`;
    }
    return `${entry.targetType}:${entry.targetId}`;
  }

  /** Qué serie es cada toma, para las entradas que apuntan a un `med_event`. */
  private async resolveSeriesIds(entries: GroupEventLog[]) {
    const doseIds = [
      ...new Set(
        entries
          .filter((e) => e.targetType === GroupEventTargetType.MED_EVENT && e.targetId)
          .map((e) => e.targetId),
      ),
    ];
    if (!doseIds.length) return new Map<number, string>();

    const doses = await this.medEventRepo.find({
      select: { id: true, seriesId: true },
      where: { id: In(doseIds) },
    });
    return new Map(
      doses.filter((d) => d.seriesId).map((d) => [d.id, d.seriesId as string]),
    );
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
