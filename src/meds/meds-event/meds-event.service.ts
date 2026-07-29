import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { In, Not, Raw, Repository } from 'typeorm';
import { Meds } from '../meds/meds.entity';
import { randomUUID } from 'crypto';
import { CreateMedEventDto, MAX_DOSES_PER_TREATMENT } from './dto/create-med-event.dto';
import { MedEvent } from './med-event.entity';

@Injectable()
export class MedsEventService {
  constructor(
    @InjectRepository(MedEvent)
    private medEventRepository: Repository<MedEvent>,
    @InjectRepository(Meds)
    private medsRepository: Repository<Meds>,
    private familyGroupsService: FamilyGroupsService,
    private notificationsService: NotificationsService,
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

  getMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getMedsEventsByDependent(dependent: Dependent) {
    return this.medEventRepository.find({
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        med: true,
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
        createdByType: 'user',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
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
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }

  // Método genérico para obtener eventos por creador
  getMedsEventsByCreator(creator: User | Dependent) {
    return this.medEventRepository.find({
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        med: true,
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
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }
  
  async createMedEvent(creator: User | Dependent, createMedEventDto: CreateMedEventDto) {
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
      this.tryCreateNotificationForMedEvent(saved, creator, medId);
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
      this.tryCreateNotificationForMedEvent(dose, creator, medId);
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
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: Not(EventStatus.CANCELED),
      },
      relations: { med: true },
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
  async cancelTreatment(seriesId: string, creator: User | Dependent) {
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
      { status: EventStatus.CANCELED, updatedAt: new Date() },
    );
    await this.cancelNotificationsFor(ids);

    return { canceled: upcoming.length };
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

  private async tryCreateNotificationForMedEvent(medEvent: MedEvent, creator: User | Dependent, medId: number) {
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
        },
      });
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

  async cancelMedEvent(id: number) {
    const result = await this.medEventRepository.update(id, {
      status: EventStatus.CANCELED,
      updatedAt: new Date(),
    });
    await this.cancelNotificationsFor([id]);
    return result;
  }

  async confirmMedEvent(id: number) {
    return this.medEventRepository.update(id, {
      status: EventStatus.CONFIRMED,
      updatedAt: new Date(),
    });
  }

  getMedEventById(id: number) {
    return this.medEventRepository.findOne({
      where: { id },
      relations: { med: true },
    });
  }
}
