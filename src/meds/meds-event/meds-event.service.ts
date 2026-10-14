import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { GroupEventAction, GroupEventTargetType } from 'src/group-events/enums/group-event-action.enum';
import { In, Not, Repository } from 'typeorm';
import { sinceStartOfToday, UPCOMING_FETCH_LIMIT } from 'src/events/utils/upcoming-window';
import { Meds } from '../meds/meds.entity';
import { randomUUID } from 'crypto';
import { assertFreePlanLimit, FREE_PLAN_LIMITS } from 'src/common/plan-limits';
import { CreateMedEventDto, MAX_DOSES_PER_TREATMENT } from './dto/create-med-event.dto';
import { MedEvent } from './med-event.entity';

/**
 * Horas de margen antes de dar por omitida una toma que nadie marcó. Pasado
 * ese tiempo se asume que no se tomó: no hay cron que la cambie de estado, la
 * omisión se calcula al vuelo cada vez que se pide la adherencia.
 */
export const ADHERENCE_GRACE_HOURS = 2;

export interface Adherence {
  taken: number;
  omitted: number;
  pending: number;
  /** Porcentaje entero (0-100) de tomas cumplidas; null si todavía no hay nada que medir. */
  pct: number | null;
}

/**
 * Adherencia de un conjunto de tomas (normalmente las de un mismo `seriesId`).
 *
 * - Tomada: `confirmed`.
 * - Omitida: `discarded` ("No la tomé"), o abierta (`created`/`sended`) cuando
 *   su horario pasó hace más de `ADHERENCE_GRACE_HOURS`.
 * - Pendiente: el resto de las abiertas.
 * - Las canceladas no cuentan para nada.
 *
 * Función pura (recibe `now`) para poder testearla sin base.
 */
export function computeAdherence(
  events: Array<{ status: string; date: Date | string }>,
  now: Date = new Date(),
): Adherence {
  const graceLimit = now.getTime() - ADHERENCE_GRACE_HOURS * 3600_000;
  let taken = 0;
  let omitted = 0;
  let pending = 0;

  for (const event of events) {
    switch (event.status) {
      case EventStatus.CONFIRMED:
        taken++;
        break;
      case EventStatus.DISCARDED:
        omitted++;
        break;
      case EventStatus.CANCELED:
        break;
      default:
        if (new Date(event.date).getTime() < graceLimit) omitted++;
        else pending++;
    }
  }

  const measured = taken + omitted;
  return {
    taken,
    omitted,
    pending,
    pct: measured ? Math.round((taken / measured) * 100) : null,
  };
}

@Injectable()
export class MedsEventService {
  constructor(
    @InjectRepository(MedEvent)
    private medEventRepository: Repository<MedEvent>,
    @InjectRepository(Meds)
    private medsRepository: Repository<Meds>,
    private familyGroupsService: FamilyGroupsService,
    private notificationsService: NotificationsService,
    private groupEventsService: GroupEventsService,
  ) {}

  // Helper para determinar el tipo de creador
  private getCreatorType(creator: User | Dependent | ProfessionalUser): string {
    if (creator instanceof Dependent) {
      return 'dependent';
    } else if (creator instanceof ProfessionalUser) {
      return 'professional';
    } else {
      return 'user';
    }
  }

  /**
   * Tope de medicamentos activos del plan gratuito, contado por creador. Un
   * tratamiento cuenta una sola vez, no una por toma.
   */
  async assertMedsLimit(creator: User | Dependent, premium: boolean) {
    const activeDoses = await this.medEventRepository.find({
      select: { id: true, seriesId: true },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: sinceStartOfToday(),
      },
    });
    const active = new Set(activeDoses.map((e) => e.seriesId ?? `single-${e.id}`)).size;
    assertFreePlanLimit(premium, active, FREE_PLAN_LIMITS.meds, 'medicamentos activos');
  }

  getMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      where: {
        createdById: user.id,
        // Un profesional también tiene eventos propios y se guardan como
        // 'professional': con 'user' fijo no le aparecían.
        createdByType: this.getCreatorType(user),
      },
      relations: {
        med: { measurementUnit: true },
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getMedsEventsByDependent(dependent: Dependent) {
    return this.medEventRepository.find({
      select: {
        takenChargeBy: { id: true, firstName: true, lastName: true },
        canceledBy: { id: true, firstName: true, lastName: true },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
      },
      relations: {
        med: { measurementUnit: true },
        // Para mostrar "X se hizo cargo" y "X canceló" sin otra consulta.
        takenChargeBy: true,
        canceledBy: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getNextMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: user.id,
        // Un profesional también tiene eventos propios y se guardan como
        // 'professional': con 'user' fijo no le aparecían.
        createdByType: this.getCreatorType(user),
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: sinceStartOfToday(),
      },
      relations: {
        med: { measurementUnit: true },
      },
      order: {
        date: 'ASC',
      },
      take: UPCOMING_FETCH_LIMIT,
    });
  }

  getNextMedsEventsByDependent(dependent: Dependent) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: sinceStartOfToday(),
      },
      relations: {
        med: { measurementUnit: true },
      },
      order: {
        date: 'ASC',
      },
      take: UPCOMING_FETCH_LIMIT,
    });
  }

  // Método genérico para obtener eventos por creador
  getMedsEventsByCreator(creator: User | Dependent) {
    return this.medEventRepository.find({
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
      },
      relations: {
        med: { measurementUnit: true },
      },
      order: {
        date: 'DESC',
      },
    });
  }

  // Método genérico para obtener próximos eventos por creador
  getNextMedsEventsByCreator(creator: User | Dependent) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: sinceStartOfToday(),
      },
      relations: {
        med: { measurementUnit: true },
      },
      order: {
        date: 'ASC',
      },
      take: UPCOMING_FETCH_LIMIT,
    });
  }
  
  /**
   * `actorUserId` es el usuario logueado que dispara la creación. Cuando el
   * evento es de un dependiente no coincide con `creator`, y es el que queda
   * registrado en el historial del grupo.
   */
  async createMedEvent(
    creator: User | Dependent,
    createMedEventDto: CreateMedEventDto,
    actorUserId?: number,
  ) {
    const dateObj = new Date(createMedEventDto.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Fecha inválida');
    }

    const { intervalHours, durationDays, medId } = createMedEventDto;
    const isTreatment = !!intervalHours && !!durationDays;

    // Toma única: se conserva el comportamiento de siempre.
    if (!isTreatment) {
      const newMedEvent = this.medEventRepository.create({
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        med: { id: medId } as any,
        date: dateObj,
      });
      const saved = await this.medEventRepository.save(newMedEvent);
      this.tryCreateNotificationForMedEvent(saved, creator, medId, actorUserId);
      return saved;
    }

    // Tratamiento periódico: una fila por toma, todas con el mismo seriesId.
    const totalDoses = Math.floor((durationDays * 24) / intervalHours);
    if (totalDoses < 1) {
      throw new Error('La duración es menor a la frecuencia elegida');
    }
    if (totalDoses > MAX_DOSES_PER_TREATMENT) {
      throw new Error(
        `El tratamiento supera el máximo de ${MAX_DOSES_PER_TREATMENT} tomas`,
      );
    }

    const seriesId = randomUUID();
    const doses = Array.from({ length: totalDoses }, (_, i) =>
      this.medEventRepository.create({
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        med: { id: medId } as any,
        date: new Date(dateObj.getTime() + i * intervalHours * 3600_000),
        seriesId,
        doseIndex: i + 1,
        totalDoses,
        intervalHours,
      }),
    );

    const saved = await this.medEventRepository.save(doses);
    for (const dose of saved) {
      this.tryCreateNotificationForMedEvent(dose, creator, medId, actorUserId);
    }
    // Se devuelve la primera toma para no romper a quien espera un solo evento.
    return saved[0];
  }

  /**
   * Agrupa los eventos por tratamiento para las listas: una fila por
   * `seriesId` con su próxima toma, en vez de N filas del mismo medicamento.
   * Las tomas únicas se devuelven con la misma forma (totalDoses: 1) para que
   * el front tenga una sola cosa que renderizar.
   */
  async getMedTreatmentsByCreator(creator: User | Dependent) {
    const events = await this.medEventRepository.find({
      // Sin el select acotado la relación arrastraría el hash de la contraseña.
      select: {
        takenChargeBy: { id: true, firstName: true, lastName: true },
        canceledBy: { id: true, firstName: true, lastName: true },
      },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
      },
      relations: {
        med: { measurementUnit: true },
        // Igual que en getMedsEventsByDependent: sin esta relación el listado
        // del grupo no podía mostrar "X se hizo cargo", porque el nombre sale
        // de acá y llegaba undefined. Lo mismo para "X canceló".
        takenChargeBy: true,
        canceledBy: true,
      },
      order: { date: 'ASC' },
    });

    const now = Date.now();
    const groups = new Map<string, any>();

    for (const event of events) {
      // Las tomas únicas quedan cada una en su propio grupo.
      const key = event.seriesId ?? `single-${event.id}`;
      let group = groups.get(key);

      if (!group) {
        group = {
          seriesId: event.seriesId,
          med: event.med,
          intervalHours: event.intervalHours,
          totalDoses: event.totalDoses ?? 1,
          createdById: event.createdById,
          createdByType: event.createdByType,
          startsAt: event.date,
          endsAt: event.date,
          confirmedDoses: 0,
          nextDose: null,
          doses: [],
        };
        groups.set(key, group);
      }

      group.doses.push(event);
      if (event.date < group.startsAt) group.startsAt = event.date;
      if (event.date > group.endsAt) group.endsAt = event.date;
      if (event.status === EventStatus.CONFIRMED) group.confirmedDoses++;

      const isUpcoming =
        new Date(event.date).getTime() >= now && event.status === EventStatus.CREATED;
      if (isUpcoming && (!group.nextDose || event.date < group.nextDose.date)) {
        group.nextDose = event;
      }
    }

    const nowDate = new Date(now);
    for (const group of groups.values()) {
      group.adherence = computeAdherence(group.doses, nowDate);
    }

    // Primero los tratamientos con toma pendiente, por proximidad; después los
    // ya terminados, del más reciente al más viejo.
    return Array.from(groups.values()).sort((a, b) => {
      if (a.nextDose && b.nextDose) {
        return new Date(a.nextDose.date).getTime() - new Date(b.nextDose.date).getTime();
      }
      if (a.nextDose) return -1;
      if (b.nextDose) return 1;
      return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime();
    });
  }

  /**
   * Cancela las tomas futuras de un tratamiento. Las pasadas se conservan
   * como historial.
   */
  async cancelTreatment(seriesId: string, creator: User | Dependent, actorUserId?: number) {
    const doses = await this.medEventRepository.find({
      where: {
        seriesId,
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: Not(EventStatus.CANCELED),
      },
    });

    const now = Date.now();
    const upcoming = doses.filter((d) => new Date(d.date).getTime() >= now);
    if (!upcoming.length) return { canceled: 0 };

    const ids = upcoming.map((d) => d.id);
    await this.medEventRepository.update(
      { id: In(ids) },
      {
        status: EventStatus.CANCELED,
        updatedAt: new Date(),
        canceledByUserId: actorUserId ?? null,
        canceledAt: new Date(),
      },
    );
    await this.cancelNotificationsFor(ids);

    // Un tratamiento se registra una sola vez, igual que al crearlo: 9 tomas
    // canceladas no son 9 entradas de historial.
    const [first] = upcoming;
    if (first) {
      const withMed = await this.medEventRepository.findOne({
        where: { id: first.id },
        relations: { med: true },
      });
      await this.logCancellation(first, withMed?.med?.name, actorUserId, {
        treatment: true,
        canceledDoses: upcoming.length,
      });
    }

    return { canceled: upcoming.length };
  }

  /**
   * Borra un recordatorio de verdad, para el caso de la carga equivocada.
   *
   * Si la toma pertenece a un tratamiento se borra **la serie entera**, nunca
   * una toma suelta: `totalDoses`, `doseIndex` e `intervalHours` están
   * denormalizados en cada fila y no se recalculan, así que sacar la toma 3 de 9
   * dejaría la app diciendo "9 tomas" sobre 8 filas y con un hueco en los
   * índices. Cancelar no tiene el problema porque la fila sobrevive.
   */
  async deleteMedEvent(id: number, actorUserId?: number) {
    const medEvent = await this.medEventRepository.findOne({
      where: { id },
      relations: { med: true },
    });
    if (!medEvent) {
      throw new NotFoundException('El recordatorio no existe');
    }

    const doses = medEvent.seriesId
      ? await this.medEventRepository.find({
          where: { seriesId: medEvent.seriesId },
          relations: { med: true },
          order: { doseIndex: 'ASC' },
        })
      : [medEvent];

    const tomado = doses.find((d) => d.takenChargeByUserId);
    if (tomado) {
      throw new ConflictException(
        'Alguien ya se hizo cargo de este recordatorio. Cancelalo en vez de borrarlo.',
      );
    }
    await this.assertCanDelete(
      medEvent.createdByType,
      medEvent.createdById,
      actorUserId,
    );

    const ids = doses.map((d) => d.id);
    // El historial primero: sobrevive al borrado porque guarda los nombres
    // resueltos y no tiene foreign key contra el evento.
    await this.logDeletion(doses[0], doses[0].med?.name, actorUserId, {
      ...(medEvent.seriesId ? { treatment: true, deletedDoses: ids.length } : {}),
    });

    try {
      await this.notificationsService.deleteForReferences(
        [NotificationType.MEDICATION, NotificationType.EVENT_TAKEN_CHARGE, NotificationType.EVENT_DECLINED],
        ids,
      );
    } catch (err) {
      console.error('Error borrando notificaciones del medicamento:', err?.message || err);
    }

    await this.medEventRepository.remove(doses);
    return { deleted: ids.length };
  }


  /**
   * Quién puede borrar. Hoy ningún endpoint de cancelar o editar valida nada
   * —cualquier usuario autenticado puede tocar el evento de cualquiera sabiendo
   * el id—, pero el borrado es destructivo y no se deshace, así que al menos
   * este no se suma al agujero.
   */
  private async assertCanDelete(
    createdByType: string,
    createdById: number,
    userId: number,
  ) {
    if (createdByType === 'dependent') {
      const group = await this.familyGroupsService.findByDependentId(createdById);
      if (!group) throw new ForbiddenException('No podés borrar este evento');
      await this.groupEventsService.assertMembership(group.id, userId);
      return;
    }
    if (createdById !== userId) {
      throw new ForbiddenException('No podés borrar este evento');
    }
  }

  /** Deja constancia del borrado, con los datos ya resueltos. */
  private async logDeletion(
    medEvent: MedEvent,
    medName?: string,
    actorUserId?: number,
    extra?: Record<string, any>,
  ) {
    try {
      if (medEvent.createdByType !== 'dependent' || !medEvent.createdById) return;

      const group = await this.familyGroupsService.findByDependentId(medEvent.createdById);
      if (!group) return;

      await this.groupEventsService.log({
        groupId: group.id,
        actorUserId: actorUserId ?? null,
        action: GroupEventAction.EVENT_DELETED,
        targetType: GroupEventTargetType.MED_EVENT,
        targetId: medEvent.id,
        payload: {
          medName: medName || 'Medicamento',
          dependentName: group.dependent
            ? `${group.dependent.firstName} ${group.dependent.lastName}`.trim()
            : null,
          eventDate: medEvent.date,
          ...(extra || {}),
        },
      });
    } catch (err) {
      console.error('Error registrando el borrado del medicamento:', err?.message || err);
    }
  }

  private async cancelNotificationsFor(medEventIds: number[]) {
    try {
      await this.notificationsService.cancelForReferences(
        NotificationType.MEDICATION,
        medEventIds,
      );
    } catch (err) {
      console.error('Error cancelando notificaciones de medicamento:', err?.message || err);
    }
  }

  private async tryCreateNotificationForMedEvent(
    medEvent: MedEvent,
    creator: User | Dependent,
    medId: number,
    actorUserId?: number,
  ) {
    try {
      const isDependent = creator instanceof Dependent;
      let groupId: number | null = null;
      let memberUserIds: number[] = [];

      if (isDependent) {
        const group = await this.familyGroupsService.findByDependentId(creator.id);
        if (!group) return;
        groupId = group.id;
        const ids = new Set<number>();
        if (group.createdBy?.id) ids.add(group.createdBy.id);
        (group.members || []).forEach(m => m?.id && ids.add(m.id));
        memberUserIds = Array.from(ids);
      } else {
        memberUserIds = [(creator as User).id];
      }

      if (!memberUserIds.length) return;

      const med = await this.medsRepository.findOne({ where: { id: medId } });
      const dependentName = isDependent
        ? `${(creator as Dependent).firstName} ${(creator as Dependent).lastName}`.trim()
        : null;

      await this.notificationsService.createForMedEventGroup({
        medEventId: medEvent.id,
        groupId,
        scheduledFor: medEvent.date,
        memberUserIds,
        payload: {
          medName: med?.name || 'Medicamento',
          dependentName,
          // El front lo necesita para volver al evento desde la push.
          dependentId: isDependent ? creator.id : null,
        },
      });

      // Un tratamiento se registra una sola vez, en su primera toma: 24 tomas
      // no son 24 entradas de historial.
      const isFirstOfSeries = !medEvent.seriesId || medEvent.doseIndex === 1;
      if (groupId && isFirstOfSeries) {
        await this.groupEventsService.log({
          groupId,
          actorUserId: actorUserId ?? null,
          action: GroupEventAction.EVENT_CREATED,
          targetType: GroupEventTargetType.MED_EVENT,
          targetId: medEvent.id,
          payload: {
            medName: med?.name || 'Medicamento',
            dependentName,
            eventDate: medEvent.date,
            ...(medEvent.seriesId
              ? { totalDoses: medEvent.totalDoses, intervalHours: medEvent.intervalHours }
              : {}),
          },
        });
      }
    } catch (err) {
      console.error('Error creando notificación de medicamento:', err?.message || err);
    }
  }

  async updateMedEvent(id: number, updateData: Partial<CreateMedEventDto>) {
    const { medId, ...rest } = updateData as any;
    return this.medEventRepository.update(id, {
      ...rest,
      ...(medId ? { med: { id: medId } as any } : {}),
      updatedAt: new Date(),
    });
  }

  async cancelMedEvent(id: number, actorUserId?: number) {
    const medEvent = await this.medEventRepository.findOne({
      where: { id },
      relations: { med: true },
    });

    const result = await this.medEventRepository.update(id, {
      status: EventStatus.CANCELED,
      updatedAt: new Date(),
      canceledByUserId: actorUserId ?? null,
      canceledAt: new Date(),
    });
    await this.cancelNotificationsFor([id]);

    if (medEvent) {
      await this.logCancellation(medEvent, medEvent.med?.name, actorUserId);
    }
    return result;
  }

  /**
   * Deja constancia en el historial de quién canceló.
   *
   * Un recordatorio cancelado desaparece de los listados (todas las consultas
   * filtran por `Not(CANCELED)`), así que sin esta entrada no quedaba ningún
   * rastro de que alguien del grupo lo dio de baja.
   */
  private async logCancellation(
    medEvent: MedEvent,
    medName?: string,
    actorUserId?: number,
    extra?: Record<string, any>,
  ) {
    try {
      if (medEvent.createdByType !== 'dependent' || !medEvent.createdById) return;

      const group = await this.familyGroupsService.findByDependentId(medEvent.createdById);
      if (!group) return;

      await this.groupEventsService.log({
        groupId: group.id,
        actorUserId: actorUserId ?? null,
        action: GroupEventAction.EVENT_CANCELED,
        targetType: GroupEventTargetType.MED_EVENT,
        targetId: medEvent.id,
        payload: {
          medName: medName || 'Medicamento',
          dependentName: group.dependent
            ? `${group.dependent.firstName} ${group.dependent.lastName}`.trim()
            : null,
          eventDate: medEvent.date,
          ...(extra || {}),
        },
      });
    } catch (err) {
      console.error('Error registrando la cancelación del medicamento:', err?.message || err);
    }
  }

  /** "La tomé". */
  async confirmMedEvent(id: number, actorUserId: number) {
    const medEvent = await this.findDoseForActor(id, actorUserId);
    await this.medEventRepository.update(id, {
      status: EventStatus.CONFIRMED,
      updatedAt: new Date(),
    });
    await this.logDoseResolution(medEvent, actorUserId, GroupEventAction.EVENT_CONFIRMED);
    return { status: EventStatus.CONFIRMED };
  }

  /** "No la tomé": la toma queda como omitida para la adherencia. */
  async skipMedEvent(id: number, actorUserId: number) {
    const medEvent = await this.findDoseForActor(id, actorUserId);
    await this.medEventRepository.update(id, {
      status: EventStatus.DISCARDED,
      updatedAt: new Date(),
    });
    await this.logDoseResolution(medEvent, actorUserId, GroupEventAction.EVENT_SKIPPED);
    return { status: EventStatus.DISCARDED };
  }

  /**
   * Sólo puede marcar una toma quien la cargó para sí, o alguien del grupo si
   * es de un dependiente. Antes `confirm` no validaba nada.
   */
  private async findDoseForActor(id: number, actorUserId: number) {
    const medEvent = await this.medEventRepository.findOne({
      where: { id },
      relations: { med: true },
    });
    if (!medEvent) {
      throw new NotFoundException('El recordatorio no existe');
    }
    if (medEvent.createdByType === 'dependent') {
      const group = await this.familyGroupsService.findByDependentId(medEvent.createdById);
      const isMember =
        !!group &&
        (group.createdBy?.id === actorUserId ||
          (group.members || []).some((m) => m?.id === actorUserId));
      if (!isMember) {
        throw new ForbiddenException('No pertenecés al grupo de este dependiente');
      }
    } else if (medEvent.createdById !== actorUserId) {
      throw new ForbiddenException('No podés modificar este recordatorio');
    }
    if (medEvent.status === EventStatus.CANCELED) {
      throw new ConflictException('El recordatorio está cancelado');
    }
    return medEvent;
  }

  private async logDoseResolution(
    medEvent: MedEvent,
    actorUserId: number,
    action: GroupEventAction,
  ) {
    try {
      if (medEvent.createdByType !== 'dependent') return;
      const group = await this.familyGroupsService.findByDependentId(medEvent.createdById);
      if (!group) return;
      await this.groupEventsService.log({
        groupId: group.id,
        actorUserId,
        action,
        targetType: GroupEventTargetType.MED_EVENT,
        targetId: medEvent.id,
        payload: {
          medName: medEvent.med?.name || 'Medicamento',
          dependentName: group.dependent
            ? `${group.dependent.firstName} ${group.dependent.lastName}`.trim()
            : null,
          eventDate: medEvent.date,
        },
      });
    } catch (err) {
      console.error('Error registrando la toma en el historial:', err?.message || err);
    }
  }

  getMedEventById(id: number) {
    return this.medEventRepository.findOne({
      // Sin el select acotado la relación arrastraría el hash de la contraseña.
      select: {
        takenChargeBy: { id: true, firstName: true, lastName: true },
        canceledBy: { id: true, firstName: true, lastName: true },
      },
      where: { id },
      relations: {
        med: { measurementUnit: true },
        takenChargeBy: true,
        canceledBy: true,
      },
    });
  }
}
