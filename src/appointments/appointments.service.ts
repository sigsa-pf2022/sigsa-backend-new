import { LessThan } from 'typeorm';
import { subDays } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationsService } from 'src/notifications/notifications.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { GroupEventAction, GroupEventTargetType } from 'src/group-events/enums/group-event-action.enum';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { In, Not, Raw, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private readonly notificationsService: NotificationsService,
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly groupEventsService: GroupEventsService,
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

  createAppointmentWithProfessionalUser(
    appointment: CreateAppointmentDTO,
    creator: User | Dependent,
    professional: ProfessionalUser,
    actorUserId?: number,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      date: appointment.date,
      description: appointment.description,
      professional,
    });
    return this.appointmentRepository.save(newAppointment).then(async saved => {
      await this.tryCreateNotificationForAppointment(saved, creator, actorUserId);
      return saved;
    });
  }

  async createAppointmentWithMyProfessional(
    appointment: CreateAppointmentDTO,
    creator: User | Dependent,
    myProfessional: Professionals,
    actorUserId?: number,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      myProfessional,
      date: appointment.date,
      description: appointment.description,
    });
    const saved = await this.appointmentRepository.save(newAppointment);
    await this.tryCreateNotificationForAppointment(saved, creator, actorUserId);
    return saved;
  }

  getAppointmentsByUser(user: User) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getAppointmentsByDependent(dependent: Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        takenChargeBy: { id: true, firstName: true, lastName: true },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
        // Para mostrar "X se hizo cargo" sin otra consulta.
        takenChargeBy: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getNextAppointmentsByUser(user: User) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }

  getNextAppointmentsByDependent(dependent: Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }

  // Método genérico para obtener citas por creador
  getAppointmentsByCreator(creator: User | Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getAppointmentById(id: number) {
    return this.appointmentRepository.findOne({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: { id },
      relations: { myProfessional: true, professional: true },
    });
  }

  cancelAppointment(id: number) {
    return this.appointmentRepository.update(
      { id },
      {
        status: EventStatus.CANCELED,
        updatedAt: new Date(),
      },
    );
  }

  confirmAppointment(id: number) {
    return this.appointmentRepository.update(
      { id },
      {
        status: EventStatus.CONFIRMED,
        updatedAt: new Date(),
      },
    );
  }

  async updateAppointmentWithProfessionalUser(id: number, body) {
    return this.appointmentRepository.update(
      { id },
      {
        date: body.date,
        description: body.description,
        professional: body.professional,
        myProfessional: null,
        updatedAt: new Date(),
      },
    );
  }

  async updateAppointmentWithMyProfessional(id: number, body) {
    return this.appointmentRepository.update(
      { id },
      {
        date: body.date,
        description: body.description,
        myProfessional: body.myProfessional,
        professional: null,
        updatedAt: new Date(),
      },
    );
  }

  async cancelOldCreatedAppointments(): Promise<number> {
    const oneDayAgo = subDays(new Date(), 1);
    const appointmentsToCancel = await this.appointmentRepository.find({
      where: {
        status: EventStatus.CREATED,
        date: LessThan(oneDayAgo),
      },
    });
    if (appointmentsToCancel.length) {
      for (const appt of appointmentsToCancel) {
        appt.status = EventStatus.CANCELED;
        appt.updatedAt = new Date();
      }
      await this.appointmentRepository.save(appointmentsToCancel);
    }
    return appointmentsToCancel.length;
  }

  /**
   * Intenta crear notificación grupal o individual para un turno recién creado.
   * - Si el creador es un Dependent: busca el FamilyGroup que tenga ese dependent.
   * - Si el creador es un User: crea notificación individual (sin groupId) apuntando sólo al usuario.
   */
  private async tryCreateNotificationForAppointment(
    appointment: Appointment,
    creator: User | Dependent,
    actorUserId?: number,
  ) {
    try {
      // Determinar si es dependiente o usuario
      const isDependent = creator instanceof Dependent;

      let groupId: number | null = null;
      let memberUserIds: number[] = [];

      if (isDependent) {
        const group = await this.familyGroupsService.findByDependentId(creator.id);
        if (!group) {
          return; // No hay grupo, no se notifica
        }
        groupId = group.id;
        const ids = new Set<number>();
        if (group.createdBy?.id) ids.add(group.createdBy.id);
        (group.members || []).forEach(m => m?.id && ids.add(m.id));
        memberUserIds = Array.from(ids);
      } else {
        // Usuario independiente: notificación individual
        memberUserIds = [ (creator as User).id ];
      }

      // Si más adelante resolvemos grupo, poblar memberUserIds con group.members + createdBy (evitar duplicados)
      if (!memberUserIds.length) {
        // sin destinatarios válidos => salir silenciosamente
        return;
      }

      // Determinar leadMinutes (constante por ahora 15)
      const leadMinutes = 15;

      // Payload simple (podemos mejorar luego con nombres de profesional)
      const professional = appointment.myProfessional || appointment.professional;
      const professionalName = professional ? `${professional.firstName || ''} ${professional.lastName || ''}`.trim() : 'Profesional';
      const dependentName = isDependent ? `${(creator as Dependent).firstName} ${(creator as Dependent).lastName}`.trim() : null;

      await this.notificationsService.createForAppointmentGroup({
        appointmentId: appointment.id,
        groupId,
        scheduledFor: appointment.date,
        leadMinutes,
        memberUserIds,
        payload: {
          professionalName,
          description: appointment.description,
          dependentName,
          // El front lo necesita para volver al evento desde la push.
          dependentId: isDependent ? creator.id : null,
        }
      });

      if (groupId) {
        await this.groupEventsService.log({
          groupId,
          actorUserId: actorUserId ?? null,
          action: GroupEventAction.EVENT_CREATED,
          targetType: GroupEventTargetType.APPOINTMENT,
          targetId: appointment.id,
          payload: {
            professionalName,
            dependentName,
            eventDate: appointment.date,
          },
        });
      }
    } catch (err) {
      // Log controlado para no romper flujo de creación de turno
      console.error('Error creando notificación de turno:', err?.message || err);
    }
  }
}
