import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashSync } from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { random } from 'src/users/utils/random-number';
import { Between, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { addDays, startOfDay, subDays } from 'date-fns';
import {
  accentInsensitive,
  boolFilter,
  buildWhere,
  paginate,
  searchText,
  textFilter,
} from 'src/common/list-query';
import { assertFreePlanLimit, FREE_PLAN_LIMITS } from 'src/common/plan-limits';
import { CreateMyProfessionalDto } from './dto/create-my-professional.dto';
import { CreateProfessionalSpecializationDto } from './dto/create-professional-specialization.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreatePatientProfessionalDto } from './dto/create-patient-professional.dto';
import { Professionals } from './entities/my-professional.entity';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { ProfessionalUser } from './entities/professional-user.entity';
import { PatientProfessional } from './entities/patient-professional.entity';
import { PatientProfessionalStatus } from './enums/patient-professional-status.enum';
import { Role } from 'src/roles/enums/role.enum';
import { DocumentsService } from 'src/documents/documents.service';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { normalizeEmail } from 'src/users/utils/normalize-email';
import {
  computeAdherence,
  MedsEventService,
} from 'src/meds/meds-event/meds-event.service';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { Appointment } from 'src/appointments/appointment.entity';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { GroupEventsService } from 'src/group-events/group-events.service';
import {
  GroupEventAction,
  GroupEventTargetType,
} from 'src/group-events/enums/group-event-action.enum';
import { ProfessionalNote } from './entities/professional-note.entity';

/**
 * La ficha muestra los tratamientos con tomas en este período (o por venir),
 * así un tratamiento que terminó hace unos días sigue mostrando su adherencia.
 */
const SUMMARY_TREATMENT_WINDOW_DAYS = 30;
const AGENDA_DEFAULT_DAYS = 30;
/** Estados de turno que no cuentan como turno por venir. */
const CLOSED_APPOINTMENT_STATUSES = [EventStatus.CANCELED, EventStatus.DISCARDED];

/**
 * Un paciente con cuenta propia que además es profesional guarda sus eventos
 * como 'professional' (ver getCreatorType en meds-event/appointments). Los ids
 * son de la misma tabla `user`, así que aceptar los dos tipos no mezcla nada.
 */
const creatorTypesFor = (patientType: string) =>
  patientType === 'dependent' ? ['dependent'] : ['user', 'professional'];

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(ProfessionalUser)
    private professionalUserRepository: Repository<ProfessionalUser>,
    @InjectRepository(Professionals)
    private myProfessionalsRepository: Repository<Professionals>,
    @InjectRepository(ProfessionalSpecialization)
    private professionalSpecializationsRepository: Repository<ProfessionalSpecialization>,
    @InjectRepository(PatientProfessional)
    private patientProfessionalRepository: Repository<PatientProfessional>,
    @InjectRepository(ProfessionalNote)
    private professionalNoteRepository: Repository<ProfessionalNote>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(MedEvent)
    private medEventRepository: Repository<MedEvent>,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly notificationsService: NotificationsService,
    private readonly medsEventService: MedsEventService,
    private readonly groupEventsService: GroupEventsService,
  ) {}

  async createMyProfessional(
    createMyProfessionalDto: CreateMyProfessionalDto,
    user: User,
  ): Promise<Professionals> {
    const current = await this.myProfessionalsRepository.count({
      where: { createdBy: { id: user.id } },
    });
    assertFreePlanLimit(
      user.premium,
      current,
      FREE_PLAN_LIMITS.myProfessionals,
      'profesionales en "Mis profesionales"',
    );
    const newProfessional = this.myProfessionalsRepository.create({
      createdBy: user,
      ...createMyProfessionalDto,
    });
    return this.myProfessionalsRepository.save(newProfessional);
  }

  async getMyProfessionalById(id: number) {
    return await this.myProfessionalsRepository.findOne({ where: { id } });
  }

  async getMyProfessionalsByUser(user: User) {
    return await this.myProfessionalsRepository.find({
      where: { createdBy: { id: user.id } },
    });
  }

  async getMyProfessionals() {
    return this.myProfessionalsRepository.find();
  }

  /**
   * Buscador de profesionales para sacar un turno. Antes se mandaba la lista
   * entera y la app filtraba; con miles de profesionales eso no escala.
   *
   * Primero van los que ya atienden al paciente (vínculo aceptado con el
   * usuario o, si el turno es para un dependiente, con el dependiente) y después
   * el resto por apellido. Se pagina en dos pasos: una consulta trae sólo los
   * ids de la página, ya ordenados, y otra carga esos profesionales con sus
   * especialidades. Paginando con el join puesto, la página se cortaría por
   * filas de especialidad y no por profesional.
   */
  async searchProfessionals(params: {
    userId: number;
    patient: { id: number; type: 'user' | 'dependent' };
    search?: string;
    specializationId?: number;
    page?: unknown;
    take?: unknown;
  }) {
    const { take, skip } = paginate(params.page, params.take ?? 20);

    const links = await this.patientProfessionalRepository.find({
      select: { professionalId: true },
      where: {
        patientId: params.patient.id,
        patientType: params.patient.type,
        status: PatientProfessionalStatus.ACCEPTED,
      },
    });
    const linkedIds = links.map((l) => l.professionalId);

    const query = this.professionalUserRepository
      .createQueryBuilder('p')
      .where('p.id != :userId', { userId: params.userId });

    const text = searchText(params.search);
    if (text) {
      // Nombre y apellido en cualquier orden: "julian ferreyra" o "ferreyra julian".
      query.andWhere(
        `(${accentInsensitive("p.firstName || ' ' || p.lastName")} LIKE :text
          OR ${accentInsensitive("p.lastName || ' ' || p.firstName")} LIKE :text)`,
        { text: `%${text}%` },
      );
    }

    if (params.specializationId) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM user_specialization_professionals_specialization ups
          WHERE ups."userId" = p.id
            AND ups."professionalsSpecializationId" = :specializationId
        )`,
        { specializationId: params.specializationId },
      );
    }

    const total = await query.getCount();

    const rows = await query
      .select('p.id', 'id')
      .addSelect('CASE WHEN p.id = ANY(:linkedIds) THEN 0 ELSE 1 END', 'rank')
      // Sin acentos: si no, "Ávila" queda después de "Paz".
      .addSelect(accentInsensitive('p.lastName'), 'sort_last')
      .addSelect(accentInsensitive('p.firstName'), 'sort_first')
      .setParameter('linkedIds', linkedIds)
      .orderBy('rank', 'ASC')
      .addOrderBy('sort_last', 'ASC')
      .addOrderBy('sort_first', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .offset(skip)
      .limit(take)
      .getRawMany<{ id: number }>();

    const ids = rows.map((r) => Number(r.id));
    const professionals = ids.length
      ? await this.professionalUserRepository.find({
          select: { id: true, firstName: true, lastName: true, licenseNumber: true },
          relations: { specialization: true },
          where: { id: In(ids) },
        })
      : [];
    const byId = new Map(professionals.map((p) => [p.id, p]));

    const data = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        licenseNumber: p.licenseNumber,
        specialization: p.specialization,
        linked: linkedIds.includes(p.id),
      }));

    return { data, total };
  }

  /** Sólo quien integra el grupo del dependiente puede sacarle un turno. */
  async assertBelongsToDependentGroup(userId: number, dependentId: number) {
    const group = await this.familyGroupsService.findByDependentId(dependentId);
    if (!group) {
      throw new NotFoundException('No se encontró el dependiente');
    }
    const isMember =
      group.createdBy?.id === userId ||
      (group.members || []).some((m) => m.id === userId);
    if (!isMember) {
      throw new ForbiddenException('No pertenecés al grupo de este dependiente');
    }
  }

  async getAllProfessionalsSpecializations() {
    return this.professionalSpecializationsRepository.find();
  }

  async getProfessionalsDashboard(
    page: number,
    quantity: number,
    firstName?: string,
    lastName?: string,
  ) {
    return this.professionalUserRepository.findAndCount({
      where: buildWhere({
        firstName: textFilter(firstName),
        lastName: textFilter(lastName),
      }),
      ...paginate(page, quantity),
      order: { firstName: 'ASC' },
    });
  }

  async getProfessionalsSpecializations(
    page: number,
    quantity: number,
    deleted: unknown,
    name?: string,
    description?: string,
  ) {
    return this.professionalSpecializationsRepository.findAndCount({
      where: buildWhere({
        deleted: boolFilter(deleted),
        name: textFilter(name),
        description: textFilter(description),
      }),
      ...paginate(page, quantity),
      order: { name: 'ASC' },
    });
  }

  async getProfessionalsSpecializationById(id: number) {
    return this.professionalSpecializationsRepository.findOneBy({ id });
  }

  async getProfessionalsSpecializationByName(name: string) {
    return this.professionalSpecializationsRepository.findOneBy({ name });
  }

  async createProfessional(
    createProfessionalDto: CreateProfessionalDto,
  ): Promise<ProfessionalUser> {
    const email = normalizeEmail(createProfessionalDto.email);

    // A diferencia del alta de usuario común, acá no había ningún chequeo de
    // duplicados: quedaba todo librado a la constraint de la base, que además
    // distingue mayúsculas.
    const existing = await this.professionalUserRepository.manager
      .getRepository(User)
      .findOne({ where: [{ email }, { dni: createProfessionalDto.dni }] });
    if (existing) {
      throw new BadRequestException('Ya existe una cuenta con ese email o DNI');
    }

    const password = hashSync(createProfessionalDto.password, 10);
    const newProfessional = this.professionalUserRepository.create({
      ...createProfessionalDto,
      email,
      password,
    });
    newProfessional.verificationCode = random();
    newProfessional.role = Role.Professional;
    return this.professionalUserRepository.save(newProfessional);
  }

  async getProfessionalById(id: number) {
    return await this.professionalUserRepository.findOne({ where: { id } });
  }

  async createSpecialization(
    createSpecializationDto: CreateProfessionalSpecializationDto,
  ) {
    const newSpecialization = this.professionalSpecializationsRepository.create(
      createSpecializationDto,
    );
    return this.professionalSpecializationsRepository.save(newSpecialization);
  }

  async updateSpecialization(id: number, body) {
    return this.professionalSpecializationsRepository.update(
      { id },
      { name: body.name, description: body.description },
    );
  }

  async toggleStatusSpecialization(id: number, deleted: boolean) {
    return this.professionalSpecializationsRepository.update({ id }, { deleted });
  }

  getMonthlyProfessionalsQuantity() {
    return this.professionalUserRepository.find({ select: { createdAt: true } });
  }

  // ---- Patient-Professional linkage ----

  async linkPatient(
    professionalId: number,
    dto: CreatePatientProfessionalDto,
  ): Promise<PatientProfessional> {
    const existing = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId: dto.patientId, patientType: dto.patientType },
    });
    if (existing) {
      throw new BadRequestException('El paciente ya está vinculado');
    }

    if (dto.patientType === 'dependent') {
      const dependent = await this.familyGroupsService.getDependentById(dto.patientId);
      if (!dependent) {
        throw new NotFoundException('No se encontró el dependiente');
      }

      const link = this.patientProfessionalRepository.create({
        professionalId,
        patientId: dto.patientId,
        patientType: 'dependent',
        status: PatientProfessionalStatus.PENDING,
      });
      const saved = await this.patientProfessionalRepository.save(link);

      // Notificar a todos los miembros del grupo familiar
      const group = await this.familyGroupsService.findByDependentId(dto.patientId);
      if (group) {
        const professional = await this.professionalUserRepository.findOne({
          where: { id: professionalId },
        });
        const memberIds = (group.members || []).map((m) => m.id);
        if (memberIds.length) {
          await this.notificationsService.createForProfessionalLinkRequest({
            patientProfessionalId: saved.id,
            memberUserIds: memberIds,
            payload: {
              professionalName: professional
                ? `${professional.firstName} ${professional.lastName}`
                : 'Un profesional',
              dependentName: `${dependent.firstName} ${dependent.lastName}`,
            },
          });
        }
      }

      return saved;
    }

    // patientType === 'user': vínculo directo, status ACCEPTED por defecto
    const link = this.patientProfessionalRepository.create({
      professionalId,
      patientId: dto.patientId,
      patientType: dto.patientType,
    });
    const savedLink = await this.patientProfessionalRepository.save(link);

    // A diferencia del dependiente, acá no hay autorización de por medio: el
    // vínculo queda hecho al instante. Al menos se le avisa a la persona, que
    // si no se enteraría recién al ver al profesional en su lista.
    try {
      const professional = await this.professionalUserRepository.findOne({
        where: { id: professionalId },
      });
      await this.notificationsService.createForProfessionalLinked({
        patientProfessionalId: savedLink.id,
        patientUserId: dto.patientId,
        payload: {
          professionalName: professional
            ? `${professional.firstName} ${professional.lastName}`.trim()
            : 'Un profesional',
          licenseNumber: professional?.licenseNumber ?? null,
        },
      });
    } catch (err) {
      // El aviso no puede tumbar la vinculación en sí.
      console.error('Error avisando al paciente de la vinculación:', err?.message || err);
    }

    return savedLink;
  }

  async unlinkPatient(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    const link = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId, patientType },
    });
    if (!link) {
      throw new NotFoundException('El vínculo no existe');
    }
    return this.patientProfessionalRepository.remove(link);
  }

  async getPatients(professionalId: number) {
    const allLinks = await this.patientProfessionalRepository.find({
      where: { professionalId },
      order: { createdAt: 'DESC' },
    });

    const enrich = async (link: PatientProfessional) => {
      let firstName = '';
      let lastName = '';
      if (link.patientType === 'user') {
        const user = await this.usersService.getUserById(link.patientId);
        if (user) { firstName = user.firstName; lastName = user.lastName; }
      } else {
        const dep = await this.familyGroupsService.getDependentById(link.patientId);
        if (dep) { firstName = dep.firstName; lastName = dep.lastName; }
      }
      return { ...link, firstName, lastName };
    };

    // Sólo los aceptados llevan el resumen: de un pendiente el profesional
    // todavía no puede ver nada.
    const accepted = await Promise.all(
      allLinks
        .filter((l) => l.status === PatientProfessionalStatus.ACCEPTED)
        .map(async (link) => {
          const [base, nextAppointment, activeTreatmentsCount] = await Promise.all([
            enrich(link),
            this.findNextAppointment(link.patientId, link.patientType),
            this.countTreatmentsInProgress(link.patientId, link.patientType),
          ]);
          return {
            ...base,
            nextAppointmentDate: nextAppointment?.date ?? null,
            activeTreatmentsCount,
          };
        }),
    );

    const pending = await Promise.all(
      allLinks
        .filter(
          (l) =>
            l.status === PatientProfessionalStatus.PENDING &&
            l.patientType === 'dependent',
        )
        .map(enrich),
    );

    return { patients: accepted, pendingRequests: pending };
  }

  /**
   * Única puerta de entrada del profesional a los datos de un paciente: tiene
   * que existir el vínculo y estar aceptado. `patientType` es obligatorio
   * porque, si llega undefined, TypeORM ignora ese filtro y un vínculo con el
   * usuario 7 habilitaría también al dependiente 7.
   */
  async assertAcceptedLink(
    professionalId: number,
    patientId: number,
    patientType: string,
  ): Promise<PatientProfessional> {
    if (patientType !== 'user' && patientType !== 'dependent') {
      throw new BadRequestException('Falta indicar el tipo de paciente');
    }
    const link = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId, patientType },
    });
    if (!link) {
      throw new ForbiddenException('No tiene vínculo con este paciente');
    }
    if (link.status !== PatientProfessionalStatus.ACCEPTED) {
      throw new ForbiddenException(
        'La vinculación aún no fue aprobada por el responsable',
      );
    }
    return link;
  }

  async getPatientDocuments(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    await this.assertAcceptedLink(professionalId, patientId, patientType);
    return this.documentsService.getDocumentsByPatient(patientId, patientType);
  }

  // ---- Seguimiento del paciente ----

  /** Nombre y datos básicos del paciente, sea usuario o dependiente. */
  private async getPatientBasics(patientId: number, patientType: string) {
    if (patientType === 'dependent') {
      const dep = await this.familyGroupsService.getDependentById(patientId);
      if (!dep) throw new NotFoundException('No se encontró el paciente');
      return {
        entity: dep,
        info: {
          id: dep.id,
          type: 'dependent',
          firstName: dep.firstName,
          lastName: dep.lastName,
          dni: dep.dni,
          birthday: dep.birthday,
          bloodType: dep.bloodType,
        },
      };
    }
    const user = await this.usersService.getUserById(patientId);
    if (!user) throw new NotFoundException('No se encontró el paciente');
    return {
      entity: user,
      info: {
        id: user.id,
        type: 'user',
        firstName: user.firstName,
        lastName: user.lastName,
        dni: user.dni,
        birthday: user.birthday,
        gender: user.gender,
      },
    };
  }

  /** Próximo turno no cancelado del paciente, con cualquier profesional. */
  private findNextAppointment(patientId: number, patientType: string) {
    return this.appointmentRepository.findOne({
      select: {
        professional: { id: true, firstName: true, lastName: true },
        myProfessional: { id: true, firstName: true, lastName: true },
      },
      where: {
        createdById: patientId,
        createdByType: In(creatorTypesFor(patientType)),
        status: Not(In(CLOSED_APPOINTMENT_STATUSES)),
        date: MoreThanOrEqual(new Date()),
      },
      relations: { professional: true, myProfessional: true },
      order: { date: 'ASC' },
    });
  }

  /**
   * Tratamientos en curso: los que tienen alguna toma no cancelada por venir.
   * Una toma única cuenta como un tratamiento, igual que en el listado de la app.
   */
  private async countTreatmentsInProgress(patientId: number, patientType: string) {
    const row = await this.medEventRepository
      .createQueryBuilder('e')
      .select(`COUNT(DISTINCT COALESCE(e."seriesId"::text, 'single-' || e.id))`, 'count')
      .where('e.createdById = :patientId', { patientId })
      .andWhere('e.createdByType IN (:...types)', { types: creatorTypesFor(patientType) })
      .andWhere('e.status != :canceled', { canceled: EventStatus.CANCELED })
      .andWhere('e.date >= :now', { now: new Date() })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private toNoteResponse(note: ProfessionalNote) {
    return {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      patientId: note.patientId,
      patientType: note.patientType,
      professional: note.professional
        ? {
            id: note.professional.id,
            firstName: note.professional.firstName,
            lastName: note.professional.lastName,
            licenseNumber: note.professional.licenseNumber,
          }
        : null,
    };
  }

  /** Ficha del paciente para el profesional vinculado. */
  async getPatientSummary(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    const link = await this.assertAcceptedLink(professionalId, patientId, patientType);
    const { entity, info } = await this.getPatientBasics(patientId, patientType);

    const now = Date.now();
    const windowStart = subDays(new Date(now), SUMMARY_TREATMENT_WINDOW_DAYS).getTime();
    const treatments = await this.medsEventService.getMedTreatmentsByCreator(entity as any);
    const recent = treatments.filter((t) =>
      t.doses.some(
        (d) =>
          d.status !== EventStatus.CANCELED &&
          new Date(d.date).getTime() >= windowStart,
      ),
    );
    // Adherencia general del período: todas las tomas de la ventana, sean de
    // tratamientos o sueltas.
    const overallAdherence = computeAdherence(
      recent.flatMap((t) =>
        t.doses.filter((d) => new Date(d.date).getTime() >= windowStart),
      ),
      new Date(now),
    );
    const activeTreatments = recent.map(({ doses, ...t }) => ({
      ...t,
      // En curso: le queda alguna toma no cancelada por delante.
      inProgress: doses.some(
        (d) =>
          d.status !== EventStatus.CANCELED && new Date(d.date).getTime() >= now,
      ),
    }));

    const [nextAppointment, lastNotes] = await Promise.all([
      this.findNextAppointment(patientId, patientType),
      this.professionalNoteRepository.find({
        where: { professionalId, patientId, patientType },
        relations: { professional: true },
        order: { createdAt: 'DESC' },
        take: 3,
      }),
    ]);

    return {
      patient: info,
      linkedSince: link.resolvedAt ?? link.createdAt,
      overallAdherence,
      activeTreatments,
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            date: nextAppointment.date,
            description: nextAppointment.description,
            status: nextAppointment.status,
            professional: nextAppointment.professional ?? nextAppointment.myProfessional ?? null,
            withMe: nextAppointment.professional?.id === professionalId,
          }
        : null,
      lastNotes: lastNotes.map((n) => this.toNoteResponse(n)),
    };
  }

  async createPatientNote(
    professionalId: number,
    patientId: number,
    patientType: string,
    content: string,
  ) {
    await this.assertAcceptedLink(professionalId, patientId, patientType);
    const { info } = await this.getPatientBasics(patientId, patientType);
    const professional = await this.professionalUserRepository.findOne({
      where: { id: professionalId },
    });

    const note = await this.professionalNoteRepository.save(
      this.professionalNoteRepository.create({
        professionalId,
        patientId,
        patientType,
        content,
      }),
    );
    note.professional = professional;

    // Ni el push ni el historial pueden tumbar la indicación ya guardada.
    try {
      const professionalName = professional
        ? `${professional.firstName} ${professional.lastName}`.trim()
        : 'Un profesional';
      const excerpt = content.length > 120 ? `${content.slice(0, 117)}...` : content;

      if (patientType === 'dependent') {
        const group = await this.familyGroupsService.findByDependentId(patientId);
        if (group) {
          const ids = new Set<number>();
          if (group.createdBy?.id) ids.add(group.createdBy.id);
          (group.members || []).forEach((m) => m?.id && ids.add(m.id));
          const dependentName = `${info.firstName} ${info.lastName}`.trim();
          await this.notificationsService.createForProfessionalNote({
            noteId: note.id,
            groupId: group.id,
            memberUserIds: Array.from(ids),
            payload: { professionalName, dependentName, dependentId: patientId, excerpt },
          });
          await this.groupEventsService.log({
            groupId: group.id,
            actorUserId: professionalId,
            action: GroupEventAction.PROFESSIONAL_NOTE,
            // Como el vínculo: fila simple en el historial, sin desplegable.
            targetType: GroupEventTargetType.MEMBER,
            targetId: professionalId,
            payload: { professionalName, dependentName, noteId: note.id, excerpt },
          });
        }
      } else {
        await this.notificationsService.createForProfessionalNote({
          noteId: note.id,
          groupId: null,
          memberUserIds: [patientId],
          payload: { professionalName, excerpt },
        });
      }
    } catch (err) {
      console.error('Error avisando la indicación:', err?.message || err);
    }

    return this.toNoteResponse(note);
  }

  /** Las indicaciones que este profesional le dejó al paciente. */
  async getPatientNotes(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    await this.assertAcceptedLink(professionalId, patientId, patientType);
    const notes = await this.professionalNoteRepository.find({
      where: { professionalId, patientId, patientType },
      relations: { professional: true },
      order: { createdAt: 'DESC' },
    });
    return notes.map((n) => this.toNoteResponse(n));
  }

  /**
   * Lado paciente: las indicaciones recibidas por el propio usuario o, con
   * `dependentId`, por el dependiente de un grupo al que pertenece.
   */
  async getReceivedNotes(userId: number, dependentId?: number) {
    if (dependentId) {
      await this.assertBelongsToDependentGroup(userId, dependentId);
    }
    const notes = await this.professionalNoteRepository.find({
      where: dependentId
        ? { patientId: dependentId, patientType: 'dependent' }
        : { patientId: userId, patientType: 'user' },
      relations: { professional: true },
      order: { createdAt: 'DESC' },
    });
    return notes.map((n) => this.toNoteResponse(n));
  }

  /**
   * Agenda del profesional: turnos que le sacaron, sólo de pacientes con
   * vínculo aceptado (un turno no le da acceso a nada por sí solo).
   */
  async getAgenda(professionalId: number, from?: string, to?: string) {
    const start = from ? new Date(from) : startOfDay(new Date());
    const end = to ? new Date(to) : addDays(start, AGENDA_DEFAULT_DAYS);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas del rango no son válidas');
    }
    if (end < start) {
      throw new BadRequestException('La fecha final es anterior a la inicial');
    }

    const links = await this.patientProfessionalRepository.find({
      where: { professionalId, status: PatientProfessionalStatus.ACCEPTED },
    });
    const linked = new Set(links.map((l) => `${l.patientType}:${l.patientId}`));
    if (!linked.size) return [];

    const appointments = await this.appointmentRepository.find({
      where: {
        professional: { id: professionalId },
        status: Not(EventStatus.CANCELED),
        date: Between(start, end),
      },
      order: { date: 'ASC' },
    });

    const patientKey = (a: Appointment) =>
      `${a.createdByType === 'dependent' ? 'dependent' : 'user'}:${a.createdById}`;
    const visible = appointments.filter((a) => linked.has(patientKey(a)));

    const names = new Map<string, string>();
    for (const key of new Set(visible.map(patientKey))) {
      const [type, id] = key.split(':');
      const { info } = await this.getPatientBasics(Number(id), type).catch(() => ({
        info: null,
      }));
      names.set(key, info ? `${info.firstName} ${info.lastName}`.trim() : 'Paciente');
    }

    return visible.map((a) => {
      const key = patientKey(a);
      const isDependent = key.startsWith('dependent:');
      return {
        id: a.id,
        date: a.date,
        description: a.description,
        status: a.status,
        patientId: a.createdById,
        patientType: isDependent ? 'dependent' : 'user',
        patientName: names.get(key),
        isDependent,
      };
    });
  }
}
